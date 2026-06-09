import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DispatchMessage } from "@proud-flow/domain";
import type { CliRuntime } from "../../src/runtime";
import {
  createCodexCliRunner,
  createDaemon,
  createMemoryCliRuntime,
  createMockCodexRunner,
  createStageCommand,
  getReconnectDelayMs,
  runCli,
  readPid,
  writePid,
  removePid,
  isProcessAlive,
  pidPath,
  logPath,
  configDir,
  resolveConfigDir,
  resolveLogPath,
  resolvePidPath,
  createLogger,
  buildWebSocketUrl,
  computeRetryDelay,
  handleWebSocketMessage,
  resolveCliBinPath,
  spawnDaemon,
  verifyDispatcherAuth,
  AUTH_FAILED_CODE,
  runWebSocketLoop,
  readDaemonLogTail,
} from "../../src/index";

// Helper to set PROUD_FLOW_CONFIG_DIR for isolated tests
function setConfigDirEnv(dir: string) {
  process.env.PROUD_FLOW_CONFIG_DIR = dir;
}

function clearConfigDirEnv() {
  delete process.env.PROUD_FLOW_CONFIG_DIR;
}

function mockAuthFetch(status = 426): typeof fetch {
  return vi.fn(async () => new Response("check", { status })) as typeof fetch;
}

async function createDaemonCliRuntime(
  testDir: string,
  options: { authStatus?: number } = {},
): Promise<CliRuntime> {
  const runtime = createMemoryCliRuntime({
    fetch: mockAuthFetch(options.authStatus),
  });
  await runtime.store.writeConfig({
    environment: "dev",
    workspacePath: testDir,
  });
  await runtime.keychain.setToken("dispatcher", "pf_dispatcher_test");
  return runtime;
}

describe("daemon dispatch protocol", () => {
  it("maps dispatch stages to fixed local Skill commands", () => {
    expect(createStageCommand("tech_design", "REQ-000123")).toBe(
      "/tech-design REQ-000123",
    );
    expect(createStageCommand("case_rundown", "REQ-000123")).toBe(
      "/case-rundown REQ-000123",
    );
    expect(createStageCommand("development", "REQ-000123")).toBe(
      "/develop REQ-000123",
    );
  });

  it("ACKs dispatch requests through a runner without using remote commands", async () => {
    const runner = createMockCodexRunner();
    const sent: unknown[] = [];
    const daemon = createDaemon({
      runner,
      send: async (message) => {
        sent.push(message);
      },
    });

    await daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_1",
      requirementId: "REQ-000123",
      stage: "tech_design",
      command: "rm -rf /",
    });

    expect(runner.calls).toEqual([{ command: "/tech-design REQ-000123" }]);
    expect(sent).toEqual([
      { type: "dispatch.acked", requestId: "dispatch_req_1", success: true },
    ]);
  });

  it("returns failure ACK when Codex is unavailable", async () => {
    const runner = createMockCodexRunner({ failWith: "Codex unavailable" });
    const sent: unknown[] = [];
    const daemon = createDaemon({
      runner,
      send: async (message) => {
        sent.push(message);
      },
    });

    await daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_2",
      requirementId: "REQ-000123",
      stage: "development",
    });

    expect(sent).toEqual([
      {
        type: "dispatch.acked",
        requestId: "dispatch_req_2",
        success: false,
        errorMessage: "Codex unavailable",
      },
    ]);
  });

  it("protects the single runner from concurrent dispatch and deduplicates request ids", async () => {
    let release: (() => void) | undefined;
    const runner = {
      calls: [] as { command: string }[],
      async run(command: string) {
        this.calls.push({ command });
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    };
    const sent: DispatchMessage[] = [];
    const daemon = createDaemon({
      runner,
      send: async (message) => {
        sent.push(message);
      },
    });

    const first = daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_3",
      requirementId: "REQ-000123",
      stage: "tech_design",
    });
    await daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_4",
      requirementId: "REQ-000124",
      stage: "case_rundown",
    });
    release?.();
    await first;
    await daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_3",
      requirementId: "REQ-000123",
      stage: "tech_design",
    });

    expect(runner.calls).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      success: false,
      errorMessage: "DISPATCHER_BUSY",
    });
    expect(sent.slice(1)).toEqual([
      { type: "dispatch.acked", requestId: "dispatch_req_3", success: true },
      { type: "dispatch.acked", requestId: "dispatch_req_3", success: true },
    ]);
  });

  it("responds to ping, validates schema, computes reconnect backoff", async () => {
    const sent: unknown[] = [];
    const daemon = createDaemon({
      runner: createMockCodexRunner(),
      send: async (message) => {
        sent.push(message);
      },
      now: () => "2026-06-04T00:00:00.000Z",
    });

    await daemon.receive({
      type: "dispatcher.ping",
      timestamp: "2026-06-04T00:00:00.000Z",
    });
    await daemon.receive({ type: "dispatch.requested", requestId: "bad" });

    expect(sent).toEqual([
      {
        type: "dispatcher.pong",
        timestamp: "2026-06-04T00:00:00.000Z",
      },
      {
        type: "dispatch.acked",
        requestId: "dispatch_req_invalid",
        success: false,
        errorMessage: "VALIDATION_ERROR",
      },
    ]);
    expect(getReconnectDelayMs(0)).toBe(1000);
    expect(getReconnectDelayMs(3)).toBe(8000);
    expect(getReconnectDelayMs(9)).toBe(30000);
  });

  it("codex cli runner executes the correct command", async () => {
    const executions: unknown[] = [];
    const codex = createCodexCliRunner({
      execute: async (command, args) => {
        executions.push([command, args]);
      },
    });
    await codex.run("/develop REQ-000123");
    expect(executions).toEqual([["codex", ["exec", "/develop REQ-000123"]]]);
  });

  it("prunes old ACK cache entries and ignores inbound ACK messages", async () => {
    const sent: DispatchMessage[] = [];
    const daemon = createDaemon({
      runner: createMockCodexRunner(),
      dedupeLimit: 1,
      send: async (message) => {
        sent.push(message);
      },
    });

    await daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_5",
      requirementId: "REQ-000123",
      stage: "tech_design",
    });
    await daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_6",
      requirementId: "REQ-000123",
      stage: "tech_design",
    });
    await daemon.receive({
      type: "dispatch.acked",
      requestId: "dispatch_req_remote_ack",
      success: true,
    });

    expect(sent).toEqual([
      { type: "dispatch.acked", requestId: "dispatch_req_5", success: true },
      { type: "dispatch.acked", requestId: "dispatch_req_6", success: true },
    ]);
  });
});

describe("child-entry utilities", () => {
  it("buildWebSocketUrl constructs correct WS URL with env override", () => {
    process.env.PROUD_FLOW_API_URL = "https://api.example.com";
    try {
      const url = buildWebSocketUrl("prod", process.env, "my-token");
      expect(url).toBe("wss://api.example.com/api/dispatch/ws?token=my-token");
    } finally {
      delete process.env.PROUD_FLOW_API_URL;
    }
  });

  it("buildWebSocketUrl replaces http with ws", () => {
    process.env.PROUD_FLOW_API_URL = "http://localhost:8787";
    try {
      const url = buildWebSocketUrl("dev", process.env, "local-token");
      expect(url).toBe("ws://localhost:8787/api/dispatch/ws?token=local-token");
    } finally {
      delete process.env.PROUD_FLOW_API_URL;
    }
  });

  it("buildWebSocketUrl falls back to default backend URL", () => {
    delete process.env.PROUD_FLOW_API_URL;
    const url = buildWebSocketUrl("prod", process.env, "token-abc");
    expect(url).toContain("wss://api.proud-flow.example");
    expect(url).toContain("token=token-abc");
  });

  it("computeRetryDelay computes exponential backoff capped at 30s", () => {
    expect(computeRetryDelay(0)).toBe(600);
    expect(computeRetryDelay(1)).toBe(1200);
    expect(computeRetryDelay(2)).toBe(2400);
    expect(computeRetryDelay(5)).toBe(19200);
    expect(computeRetryDelay(6)).toBe(30000);
    expect(computeRetryDelay(10)).toBe(30000);
  });

  it("handleWebSocketMessage processes ping message", () => {
    const sent: string[] = [];
    const mockWs = {
      readyState: 1, // OPEN
      send: (data: string) => { sent.push(data); },
    } as unknown as WebSocket;
    const daemon = createDaemon({
      runner: createMockCodexRunner(),
      send: async () => {},
    });
    const logger = {
      debug: (_obj: unknown, _msg?: string) => {},
      info: (_obj: unknown, _msg?: string) => {},
      error: (_obj: unknown, _msg?: string) => {},
    };

    handleWebSocketMessage(
      mockWs,
      JSON.stringify({ type: "dispatcher.ping" }),
      daemon,
      logger,
    );
    expect(sent.length).toBe(1);
    const parsed = JSON.parse(sent[0]);
    expect(parsed.type).toBe("dispatcher.pong");
  });

  it("handleWebSocketMessage processes dispatch.requested message", () => {
    const mockWs = {
      readyState: 1,
      send: (_data: string) => {},
    } as unknown as WebSocket;
    const runner = createMockCodexRunner();
    const logMsgs: string[] = [];
    const daemon = createDaemon({
      runner,
      send: async () => {},
    });
    const logger = {
      debug: (_obj: unknown, _msg?: string) => {},
      info: (_obj: unknown, msg?: string) => { if (msg) logMsgs.push(msg); },
      error: (_obj: unknown, _msg?: string) => {},
    };

    handleWebSocketMessage(
      mockWs,
      JSON.stringify({
        type: "dispatch.requested",
        requestId: "req-1",
        requirementId: "REQ-1",
        stage: "tech_design",
      }),
      daemon,
      logger,
    );
    expect(logMsgs).toContain("dispatch");
  });

  it("handleWebSocketMessage handles invalid JSON gracefully", () => {
    const mockWs = {
      readyState: 1,
      send: (_data: string) => {},
    } as unknown as WebSocket;
    const daemon = createDaemon({
      runner: createMockCodexRunner(),
      send: async () => {},
    });
    const debugMsgs: unknown[] = [];
    const logger = {
      debug: (obj: unknown) => { debugMsgs.push(obj); },
      info: (_obj: unknown, _msg?: string) => {},
      error: (_obj: unknown, _msg?: string) => {},
    };

    handleWebSocketMessage(mockWs, "not json at all", daemon, logger);
    expect(debugMsgs.length).toBe(1);
  });

  it("handleWebSocketMessage ignores unknown message types", () => {
    const sent: string[] = [];
    const mockWs = {
      readyState: 1,
      send: (data: string) => { sent.push(data); },
    } as unknown as WebSocket;
    const daemon = createDaemon({
      runner: createMockCodexRunner(),
      send: async () => {},
    });
    const logger = {
      debug: (_obj: unknown, _msg?: string) => {},
      info: (_obj: unknown, _msg?: string) => {},
      error: (_obj: unknown, _msg?: string) => {},
    };

    handleWebSocketMessage(
      mockWs,
      JSON.stringify({ type: "unknown.type" }),
      daemon,
      logger,
    );
    expect(sent.length).toBe(0);
  });
});

describe("daemon spawn and process management", () => {
  const testDir = join(tmpdir(), "proud-flow-test-" + Date.now());

  beforeEach(() => {
    setConfigDirEnv(testDir);
    removePid();
  });

  afterEach(() => {
    clearConfigDirEnv();
    removePid();
  });

  it("readPid returns undefined when no PID file exists", () => {
    removePid();
    expect(readPid()).toBeUndefined();
  });

  it("writePid and readPid round-trip correctly", () => {
    writePid(12345);
    expect(readPid()).toBe(12345);
    removePid();
  });

  it("removePid is idempotent (no error when file does not exist)", () => {
    removePid();
    removePid(); // should not throw
    expect(readPid()).toBeUndefined();
  });

  it("readPid handles non-numeric content gracefully", () => {
    writeFileSync(resolvePidPath(), "not-a-number", "utf8");
    const result = readPid();
    expect(isNaN(result as number)).toBe(true);
    removePid();
  });

  it("isProcessAlive returns true for current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it("isProcessAlive returns false for non-existent PID", () => {
    expect(isProcessAlive(99999)).toBe(false);
  });

  it("pidPath is under config directory", () => {
    expect(pidPath()).toContain("daemon.pid");
    expect(pidPath()).toContain(configDir());
  });

  it("logPath is under config directory", () => {
    expect(logPath()).toContain("current.log");
    expect(logPath()).toContain(configDir());
  });

  it("resolveConfigDir uses env var when set", () => {
    const customDir = join(tmpdir(), "custom-proud-flow");
    process.env.PROUD_FLOW_CONFIG_DIR = customDir;
    try {
      expect(resolveConfigDir()).toBe(customDir);
    } finally {
      delete process.env.PROUD_FLOW_CONFIG_DIR;
    }
  });

  it("resolveLogPath returns path ending in current.log", () => {
    expect(resolveLogPath()).toMatch(/current\.log$/);
  });

  it("resolvePidPath returns path ending in daemon.pid", () => {
    expect(resolvePidPath()).toMatch(/daemon\.pid$/);
  });

  it("resolveCliBinPath prefers PROUD_FLOW_CLI_BIN over argv", () => {
    const customBin = join(testDir, "custom-bin.js");
    process.env.PROUD_FLOW_CLI_BIN = customBin;
    try {
      expect(resolveCliBinPath()).toBe(customBin);
    } finally {
      delete process.env.PROUD_FLOW_CLI_BIN;
    }
  });
});

describe("verifyDispatcherAuth", () => {
  it("accepts 426 as authenticated dispatcher", async () => {
    await expect(
      verifyDispatcherAuth({
        environment: "dev",
        env: { PROUD_FLOW_API_URL: "http://127.0.0.1:8787" },
        token: "pf_dispatcher_test",
        fetch: mockAuthFetch(426),
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects 403 with AUTH_FAILED", async () => {
    await expect(
      verifyDispatcherAuth({
        environment: "dev",
        env: { PROUD_FLOW_API_URL: "http://127.0.0.1:8787" },
        token: "pf_dispatcher_bad",
        fetch: mockAuthFetch(403),
      }),
    ).rejects.toThrow(AUTH_FAILED_CODE);
  });

  it("rejects network errors with API_UNREACHABLE", async () => {
    await expect(
      verifyDispatcherAuth({
        environment: "dev",
        env: { PROUD_FLOW_API_URL: "http://127.0.0.1:8787" },
        token: "pf_dispatcher_test",
        fetch: vi.fn(async () => {
          throw new Error("connection refused");
        }) as typeof fetch,
      }),
    ).rejects.toThrow("Cannot reach API");
  });
});

describe("runWebSocketLoop shutdown", () => {
  it("stop is idempotent and returns a handle", () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const loop = runWebSocketLoop({
      environment: "dev",
      env: { PROUD_FLOW_API_URL: "http://127.0.0.1:8787" },
      token: "pf_dispatcher_test",
      logger,
      fetch: mockAuthFetch(426),
    });
    expect(typeof loop.stop).toBe("function");
    expect(() => {
      loop.stop();
      loop.stop();
    }).not.toThrow();
    loop.stop();
  });
});

describe("daemon logger module", () => {
  it("createLogger returns a pino logger instance", async () => {
    const testDir = join(tmpdir(), `proud-flow-log-create-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    setConfigDirEnv(testDir);
    try {
      const logger = await createLogger(true);
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
      logger.info({}, "timestamp format check");
      await new Promise((resolve) => setTimeout(resolve, 100));
      const log = readFileSync(join(testDir, "current.log"), "utf8");
      expect(log).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      expect(log).not.toMatch(/"time":\d+/);
    } finally {
      clearConfigDirEnv();
    }
  });

  it("readDaemonLogTail reads current.log", () => {
    const testDir = join(tmpdir(), `proud-flow-log-read-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    setConfigDirEnv(testDir);
    try {
      writeFileSync(join(testDir, "current.log"), "alpha\nbeta\n", "utf8");
      expect(readDaemonLogTail(10)).toContain("beta");
    } finally {
      clearConfigDirEnv();
    }
  });
});

describe("daemon CLI commands", () => {
  const testDir = join(tmpdir(), "proud-flow-cli-test-" + Date.now());
  const daemonStubPath = join(testDir, "daemon-stub.mjs");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    setConfigDirEnv(testDir);
    removePid();
    writeFileSync(
      daemonStubPath,
      [
        'process.on("SIGTERM", () => process.exit(0));',
        'process.on("SIGINT", () => process.exit(0));',
        "setInterval(() => {}, 60_000);",
        "",
      ].join("\n"),
      "utf8",
    );
    process.env.PROUD_FLOW_CLI_BIN = daemonStubPath;
  });

  afterEach(() => {
    const pid = readPid();
    if (pid && isProcessAlive(pid)) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // ignore
      }
    }
    clearConfigDirEnv();
    delete process.env.PROUD_FLOW_CLI_BIN;
    removePid();
    try {
      unlinkSync(daemonStubPath);
    } catch {
      // ignore
    }
  });

  it("daemon status shows not running when no PID", async () => {
    removePid();
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    await runtime.keychain.setToken("dispatcher", "pf_token");
    const result = await runCli(["daemon", "status"], runtime);
    expect(result.stdout).toContain("Daemon not running");
  });

  it("daemon status shows running when PID exists and process is alive", async () => {
    writePid(process.pid);
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "status"], runtime);
    expect(result.stdout).toContain("Daemon running");
    removePid();
  });

  it("daemon status in JSON mode returns {running: false}", async () => {
    removePid();
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    await runtime.keychain.setToken("dispatcher", "pf_token");
    const result = await runCli(["daemon", "status", "--json"], runtime);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ running: false });
  });

  it("daemon status in JSON mode returns {running: true, pid} when alive", async () => {
    writePid(process.pid);
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "status", "--json"], runtime);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.running).toBe(true);
    expect(parsed.pid).toBe(process.pid);
    removePid();
  });

  it("daemon status clears stale PID and returns not running", async () => {
    writePid(99999); // non-existent process
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "status"], runtime);
    expect(result.stdout).toContain("Daemon not running");
    expect(readPid()).toBeUndefined(); // PID file should be cleaned
  });

  it("daemon stop when not running", async () => {
    removePid();
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    await runtime.keychain.setToken("dispatcher", "pf_token");
    const result = await runCli(["daemon", "stop"], runtime);
    expect(result.stdout).toContain("Daemon not running");
  });

  it("daemon stop in JSON mode returns {stopped: false}", async () => {
    removePid();
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    await runtime.keychain.setToken("dispatcher", "pf_token");
    const result = await runCli(["daemon", "stop", "--json"], runtime);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ stopped: false });
  });

  it("daemon stop cleans up a stale PID file", async () => {
    writePid(99999);
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "stop"], runtime);
    expect(result.stdout).toContain("Daemon stopped");
    expect(readPid()).toBeUndefined();
  });

  it("daemon stop in JSON mode for stale PID", async () => {
    writePid(99999);
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "stop", "--json"], runtime);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.stopped).toBe(true);
    expect(parsed.pid).toBe(99999);
  });

  it("daemon stop terminates a running background daemon", async () => {
    const { pid: oldPid } = spawnDaemon({ binPath: daemonStubPath });
    writePid(oldPid);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isProcessAlive(oldPid)).toBe(true);

    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "stop"], runtime);
    expect(result.stdout).toContain("Daemon stopped");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isProcessAlive(oldPid)).toBe(false);
    expect(readPid()).toBeUndefined();
  });

  it("daemon background start replaces an existing daemon", async () => {
    const { pid: oldPid } = spawnDaemon({ binPath: daemonStubPath });
    writePid(oldPid);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isProcessAlive(oldPid)).toBe(true);

    const runtime = await createDaemonCliRuntime(testDir);
    const result = await runCli(["daemon"], runtime);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Daemon started");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(isProcessAlive(oldPid)).toBe(false);
    const newPid = readPid();
    expect(newPid).toBeDefined();
    expect(newPid).not.toBe(oldPid);
    if (newPid) {
      try {
        process.kill(newPid, "SIGTERM");
      } catch {
        // ignore
      }
    }
    removePid();
  });

  it("daemon background start fails when auth check fails", async () => {
    removePid();
    const runtime = await createDaemonCliRuntime(testDir, { authStatus: 403 });
    const result = await runCli(["daemon"], runtime);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(readPid()).toBeUndefined();
  });

  it("daemon background start returns JSON auth error in stderr", async () => {
    removePid();
    const runtime = await createDaemonCliRuntime(testDir, { authStatus: 403 });
    const result = await runCli(["daemon", "--json"], runtime);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stderr);
    expect(parsed.error.code).toBe(AUTH_FAILED_CODE);
    expect(readPid()).toBeUndefined();
  });

  it("daemon background start spawns child and returns success", async () => {
    removePid();
    const runtime = await createDaemonCliRuntime(testDir);
    const result = await runCli(["daemon"], runtime);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Daemon started");
    expect(result.stdout).toContain("PID:");
    removePid();
  });

  it("daemon background start JSON mode returns started + pid", async () => {
    removePid();
    const runtime = await createDaemonCliRuntime(testDir);
    const result = await runCli(["daemon", "--json"], runtime);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.started).toBe(true);
    expect(typeof parsed.pid).toBe("number");
    expect(parsed.log).toContain("current.log");
    removePid();
  });

  it("daemon background start clears stale PID before spawning", async () => {
    writePid(99999); // stale
    const runtime = await createDaemonCliRuntime(testDir);
    const result = await runCli(["daemon"], runtime);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Daemon started");
    removePid();
  });

  it("daemon logs reports no log when file missing", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "logs"], runtime);
    expect(result.stdout).toContain("No daemon log found");
  });

  it("daemon logs reads last N lines from current.log", async () => {
    const logFile = join(testDir, "current.log");
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    writeFileSync(logFile, lines.join("\n"), "utf8");

    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "logs"], runtime);
    const outputLines = result.stdout.trim().split("\n");
    expect(outputLines.length).toBeLessThanOrEqual(50);
    expect(outputLines[outputLines.length - 1]).toBe("line 100");
  });

  it("daemon logs --lines N shows specified number of lines", async () => {
    const logFile = join(testDir, "current.log");
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    writeFileSync(logFile, lines.join("\n"), "utf8");

    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: testDir,
    });
    const result = await runCli(["daemon", "logs", "--lines", "5"], runtime);
    const outputLines = result.stdout.trim().split("\n");
    expect(outputLines.length).toBe(5);
    expect(outputLines[0]).toBe("line 16");
    expect(outputLines[4]).toBe("line 20");
  });
});
