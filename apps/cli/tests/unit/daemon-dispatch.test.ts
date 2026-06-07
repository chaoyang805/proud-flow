import { describe, expect, it } from "vitest";
import type { DispatchMessage } from "@proud-flow/domain";
import {
  createCodexCliRunner,
  createDaemon,
  createMemoryCliRuntime,
  createMockCodexRunner,
  createStageCommand,
  getReconnectDelayMs,
  runCli,
} from "../../src/index";

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

  it("responds to ping, validates schema, computes reconnect backoff, and exposes daemon CLI status", async () => {
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

    const executions: unknown[] = [];
    const codex = createCodexCliRunner({
      execute: async (command, args) => {
        executions.push([command, args]);
      },
    });
    await codex.run("/develop REQ-000123");
    expect(executions).toEqual([["codex", ["exec", "/develop REQ-000123"]]]);

    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: process.cwd(),
    });
    const missing = await runCli(["daemon", "--json"], runtime);
    expect(missing.exitCode).toBe(1);
    expect(JSON.parse(missing.stderr).error.code).toBe("INTERNAL_ERROR");

    await runtime.keychain.setToken("dispatcher", "pf_dispatcher_token");
    const status = await runCli(["daemon", "--json"], runtime);
    expect(JSON.parse(status.stdout).ready).toBe(true);
  });

  it("processes one pending dispatch request through the CLI daemon helper", async () => {
    const { createApiApp, hashToken } = await import("../../../api/src/index");
    const app = createApiApp();
    const bootstrapHash = await hashToken("daemon-once-bootstrap", "pepper");
    const env = {
      BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
      TOKEN_HASH_SECRET: "pepper",
    };
    const runtime = createMemoryCliRuntime({
      fetch: (url, init) =>
        app.fetch(
          new Request(url, {
            method: init?.method,
            headers: init?.headers,
            body: init?.body,
          }),
          env,
        ),
      env: { PROUD_FLOW_API_URL: "https://api.test" },
    });

    await runCli(
      [
        "init",
        "--env",
        "dev",
        "--bootstrap-token",
        "daemon-once-bootstrap",
        "--machine-name",
        "daemon-once",
      ],
      runtime,
    );

    await app.fetch(
      new Request("https://api.test/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Daemon once",
          description: "dispatch helper",
          priority: "high",
        }),
      }),
      env,
    );
    await app.fetch(
      new Request("https://api.test/api/requirements/REQ-000001/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "tech_design" }),
      }),
      env,
    );

    const processed = await runCli(["daemon", "--once", "--json"], runtime);
    const payload = JSON.parse(processed.stdout);
    expect(payload.processed).toBe(true);
    expect(payload.acknowledged).toBe(true);
    expect(payload.command).toBe("/tech-design REQ-000001");
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
