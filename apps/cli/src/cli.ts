import { Buffer } from "node:buffer";
import {
  createProudFlowApiClient,
  ProudFlowApiError,
} from "@proud-flow/api-client";
import type { ArtifactType, DispatchStage } from "@proud-flow/domain";
import process from "node:process";
import { createMockCodexRunner } from "./daemon/codex-runner";
import { createDaemon } from "./daemon/daemon";
import { getBackendUrl, isEnvironment } from "./environment";
import type { CliConfig, CliRuntime, StoredTokenType } from "./runtime";
import { getSkillStatuses, installSkills } from "./skills/installer";
import {
  pidPath,
  logPath,
  readPid,
  writePid,
  removePid,
  isProcessAlive,
  spawnDaemon,
} from "./daemon/spawn";
import { join } from "node:path";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type ParsedArgs = {
  command: string[];
  flags: Record<string, string | true>;
  positional: string[];
  json: boolean;
};

export async function runCli(
  args: readonly string[],
  runtime: CliRuntime,
): Promise<CliResult> {
  try {
    const parsed = parseArgs(args);
    const result = await dispatch(parsed, runtime);
    return { exitCode: 0, stdout: result, stderr: "" };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: formatError(error, args.includes("--json")),
    };
  }
}

async function dispatch(parsed: ParsedArgs, runtime: CliRuntime): Promise<string> {
  const [command, subcommand] = parsed.command;
  if (command === "init") return initCommand(parsed, runtime);
  if (command === "status") return statusCommand(parsed, runtime);
  if (command === "auth" && subcommand === "status") {
    return authStatusCommand(parsed, runtime);
  }
  if (command === "auth" && subcommand === "rotate") {
    return authRotateCommand(parsed, runtime);
  }
  if (command === "auth" && subcommand === "logout") {
    return authLogoutCommand(runtime);
  }
  if (command === "skill") return skillCommand(parsed, runtime);
  if (command === "daemon") return daemonCommand(parsed, runtime);
  return skillHelperCommand(parsed, runtime);
}

async function initCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const environment = stringFlag(parsed, "env") ?? "prod";
  if (!isEnvironment(environment)) throw new Error("Invalid environment");
  const machineName = stringFlag(parsed, "machine-name") ?? "local-machine";
  const bootstrapToken = requiredFlag(parsed, "bootstrap-token");
  const client = createProudFlowApiClient({
    baseUrl: getBackendUrl(environment, runtime.env),
    fetch: runtime.fetch,
  });
  const response = await client.local.bootstrap({
    bootstrapToken,
    machineName,
  });
  await runtime.store.writeConfig({
    environment,
    machineName,
    workspacePath: runtime.cwd,
  });
  await runtime.keychain.setToken("skill", response.tokens.skill);
  await runtime.keychain.setToken("dispatcher", response.tokens.dispatcher);
  await runtime.keychain.setToken("local", response.tokens.local);
  return parsed.json
    ? json({ initialized: true, environment, machineName })
    : `Initialized Proud Flow CLI for ${environment}\n`;
}

async function statusCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const config = await requireConfig(runtime);
  const authenticated = Boolean(await runtime.keychain.getToken("skill"));
  const payload = {
    environment: config.environment ?? "prod",
    workspacePath: config.workspacePath,
    authenticated,
  };
  return parsed.json
    ? json(payload)
    : `Proud Flow CLI\nEnvironment: ${payload.environment}\nAuthenticated: ${payload.authenticated ? "yes" : "no"}\n`;
}

async function authStatusCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const payload = {
    authenticated: Boolean(await runtime.keychain.getToken("skill")),
    hasDispatcherToken: Boolean(await runtime.keychain.getToken("dispatcher")),
    hasLocalToken: Boolean(await runtime.keychain.getToken("local")),
  };
  return parsed.json
    ? json(payload)
    : `Authenticated: ${payload.authenticated ? "yes" : "no"}\n`;
}

async function authRotateCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const tokenType = (stringFlag(parsed, "type") ?? "skill") as StoredTokenType;
  if (!["skill", "dispatcher", "local"].includes(tokenType)) {
    throw new Error("Invalid token type");
  }
  const client = await createLocalClient(runtime);
  const response = await client.local.rotateToken({ tokenType });
  await runtime.keychain.setToken(tokenType, response.token);
  return parsed.json ? json({ rotated: tokenType }) : `Rotated ${tokenType} token\n`;
}

async function authLogoutCommand(runtime: CliRuntime): Promise<string> {
  const localToken = await runtime.keychain.getToken("local");
  if (localToken) {
    const client = await createLocalClient(runtime);
    await Promise.all([
      client.local.revokeToken({ tokenType: "skill" }),
      client.local.revokeToken({ tokenType: "dispatcher" }),
      client.local.revokeToken({ tokenType: "local" }),
    ]);
  }
  await runtime.keychain.deleteToken("skill");
  await runtime.keychain.deleteToken("dispatcher");
  await runtime.keychain.deleteToken("local");
  await runtime.store.clearConfig();
  return "Logged out Proud Flow CLI\n";
}

async function daemonCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const [_, subcommand] = parsed.command;

  if (subcommand === "status") {
    const pid = readPid();
    if (!pid) {
      return parsed.json ? json({ running: false }) : "Daemon not running\n";
    }
    if (isProcessAlive(pid)) {
      return parsed.json
        ? json({ running: true, pid })
        : `Daemon running (PID: ${pid})\n`;
    }
    removePid();
    return parsed.json ? json({ running: false }) : "Daemon not running\n";
  }

  if (subcommand === "stop") {
    const pid = readPid();
    if (!pid) {
      return parsed.json ? json({ stopped: false }) : "Daemon not running\n";
    }
    try {
      process.kill(pid, "SIGTERM");
      removePid();
      return parsed.json
        ? json({ stopped: true, pid })
        : `Daemon stopped (PID: ${pid})\n`;
    } catch {
      removePid();
      return parsed.json ? json({ stopped: false }) : "Daemon not running\n";
    }
  }

  if (subcommand === "logs") {
    return daemonLogsCommand(parsed, runtime);
  }

  // Start daemon
  const foreground = parsed.flags.foreground === true;

  // Check already running
  const existingPid = readPid();
  if (existingPid && isProcessAlive(existingPid)) {
    throw new Error(`Daemon already running (PID: ${existingPid})`);
  }
  removePid();

  if (foreground) {
    return daemonForeground(parsed, runtime);
  }

  // Background mode: spawn child process
  const { pid } = spawnDaemon({
    binPath: join(runtime.cwd, "dist", "bin.js"),
  });
  writePid(pid);
  return parsed.json
    ? json({ started: true, pid, log: logPath() })
    : `Daemon started (PID: ${pid}, log: ${logPath()})\n`;
}

async function daemonForeground(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("dispatcher");
  if (!token) throw new Error("Missing dispatcher token");

  const wsUrl = `${getBackendUrl(
    config.environment ?? "prod",
    runtime.env,
  ).replace(/^http/, "ws")}/api/dispatch/ws?token=${encodeURIComponent(token)}`;

  process.stdout.write(`[daemon] starting foreground, environment=${config.environment ?? "prod"} PID=${process.pid}\n`);
  process.stdout.write(`[daemon] WebSocket: ${wsUrl}\n`);

  process.on("SIGINT", () => {
    process.stdout.write("[daemon] SIGINT, shutting down\n");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    process.stdout.write("[daemon] SIGTERM, shutting down\n");
    process.exit(0);
  });

  let retryMs = 600;

  const connect = () => {
    process.stdout.write("[daemon] connecting WebSocket...\n");
    const ws = new WebSocket(wsUrl);
    const runner = createMockCodexRunner();
    const daemon = createDaemon({
      runner,
      send: async (message) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          process.stdout.write(`[daemon] sent: ${message.type}\n`);
        }
      },
    });

    ws.onopen = () => {
      retryMs = 600;
      process.stdout.write("[daemon] WebSocket connected\n");
    };

    ws.onmessage = (event) => {
      const data = String(event.data);
      try {
        const msg = JSON.parse(data);
        process.stdout.write(`[daemon] received: type=${msg.type}\n`);
        if (msg.type === "dispatcher.ping") {
          process.stdout.write("[daemon] heartbeat: received ping from api\n");
          ws.send(JSON.stringify({ type: "dispatcher.pong", timestamp: new Date().toISOString() }));
          return;
        }
        if (msg.type === "dispatch.requested") {
          process.stdout.write(`[daemon] dispatch: requestId=${msg.requestId} requirement=${msg.requirementId} stage=${msg.stage}\n`);
          daemon.receive(msg);
          return;
        }
      } catch {
        process.stdout.write(`[daemon] raw: ${data}\n`);
      }
    };

    ws.onclose = () => {
      process.stdout.write(`[daemon] WebSocket closed, retry in ${retryMs}ms\n`);
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30_000);
    };

    ws.onerror = () => {
      process.stdout.write("[daemon] WebSocket connection failed (check token and API)\n");
    };
  };

  connect();

  // Block forever — the promise never resolves, this keeps the process alive
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return await new Promise(() => {});
}

async function daemonLogsCommand(
  parsed: ParsedArgs,
  _runtime: CliRuntime,
): Promise<string> {
  const { readFileSync, existsSync } = await import("node:fs");
  const { execSync } = await import("node:child_process");
  const lines = Number(parsed.flags.lines) || 50;
  const follow = parsed.flags.follow === true;
  const logFile = logPath();

  if (!existsSync(logFile)) {
    return "No daemon log found\n";
  }

  if (follow) {
    execSync(`tail -n ${lines} -f "${logFile}"`, {
      stdio: "inherit",
    });
    return "";
  }

  // Read last N lines
  const content = readFileSync(logFile, "utf8");
  const allLines = content.split("\n").filter(Boolean);
  const lastLines = allLines.slice(-lines);
  return lastLines.join("\n") + "\n";
}

async function skillCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const subcommand = parsed.command[1];
  const client = await createLocalClient(runtime);
  const manifest = await client.local.getSkillManifest();
  if (subcommand === "install" || subcommand === "update") {
    const result = await installSkills(runtime, manifest, {
      force: parsed.flags.force === true,
    });
    return parsed.json
      ? json(result)
      : `Installed Skills: ${result.installed.map((item) => item.name).join(", ") || "none"}\nSkipped: ${result.skipped.map((item) => item.name).join(", ") || "none"}\n`;
  }
  if (subcommand === "status") {
    const payload = { skills: await getSkillStatuses(runtime, manifest) };
    return parsed.json
      ? json(payload)
      : payload.skills
          .map(
            (skill) =>
              `${skill.name}: ${skill.status} (${skill.localVersion ?? "not installed"} -> ${skill.remoteVersion})`,
          )
          .join("\n")
          .concat("\n");
  }
  throw new Error(`Unknown skill command: ${subcommand ?? ""}`);
}

async function skillHelperCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
): Promise<string> {
  const requirementId = parsed.positional[0];
  if (!requirementId) throw new Error("Missing requirement id");
  const client = await createSkillClient(runtime);
  const command = parsed.command[0];
  let payload: unknown;
  if (command === "get-requirement") {
    payload = await client.skills.getRequirement(requirementId);
  } else if (command === "get-task-context") {
    payload = await client.skills.getTaskContext(requirementId);
  } else if (command === "start-stage") {
    payload = await client.skills.startStage(requirementId, {
      stage: requiredStage(parsed),
    });
  } else if (command === "attach-artifact") {
    payload = await client.skills.attachArtifact(requirementId, {
      type: requiredArtifactType(parsed),
      title: requiredFlag(parsed, "title"),
      url: stringFlag(parsed, "url"),
      content: stringFlag(parsed, "content"),
    });
  } else if (command === "upload-artifact") {
    const filePath = requiredFlag(parsed, "file");
    const content = await runtime.readFile(filePath);
    payload = await client.skills.uploadArtifact(requirementId, {
      type: requiredArtifactType(parsed),
      title: requiredFlag(parsed, "title"),
      fileName: filePath.split("/").at(-1) ?? "artifact",
      contentType: stringFlag(parsed, "content-type") ?? "application/octet-stream",
      contentBase64: Buffer.from(content).toString("base64"),
    });
  } else if (command === "complete-stage") {
    payload = await client.skills.completeStage(requirementId, {
      stage: requiredStage(parsed),
    });
  } else if (command === "fail-stage") {
    payload = await client.skills.failStage(requirementId, {
      stage: requiredStage(parsed),
      message: requiredFlag(parsed, "message"),
    });
  } else if (command === "append-note") {
    payload = await client.skills.addNote(requirementId, {
      message: requiredFlag(parsed, "message"),
    });
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
  return parsed.json ? json(payload) : markdown(command, payload);
}

async function createLocalClient(runtime: CliRuntime) {
  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("local");
  if (!token) throw new Error("Missing local token");
  return createProudFlowApiClient({
    baseUrl: getBackendUrl(config.environment ?? "prod", runtime.env),
    token,
    fetch: runtime.fetch,
  });
}

async function createSkillClient(runtime: CliRuntime) {
  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("skill");
  if (!token) throw new Error("Missing skill token");
  return createProudFlowApiClient({
    baseUrl: getBackendUrl(config.environment ?? "prod", runtime.env),
    token,
    fetch: runtime.fetch,
  });
}

async function createDispatcherClient(runtime: CliRuntime, token: string) {
  const config = await requireConfig(runtime);
  return createProudFlowApiClient({
    baseUrl: getBackendUrl(config.environment ?? "prod", runtime.env),
    token,
    fetch: runtime.fetch,
  });
}

async function requireConfig(runtime: CliRuntime): Promise<CliConfig> {
  const config = await runtime.store.readConfig();
  if (!config) throw new Error("Proud Flow CLI is not initialized");
  return config;
}

function parseArgs(args: readonly string[]): ParsedArgs {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  const command: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item.startsWith("--")) {
      const key = item.slice(2);
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        index += 1;
      }
    } else if (
      command.length === 0 ||
      ((command[0] === "auth" || command[0] === "skill" || command[0] === "daemon") && command.length === 1)
    ) {
      command.push(item);
    } else {
      positional.push(item);
    }
  }
  return { command, flags, positional, json: flags.json === true };
}

function requiredFlag(parsed: ParsedArgs, name: string): string {
  const value = stringFlag(parsed, name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function stringFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags[name];
  return typeof value === "string" ? value : undefined;
}

function requiredStage(parsed: ParsedArgs): DispatchStage {
  return requiredFlag(parsed, "stage") as DispatchStage;
}

function requiredArtifactType(parsed: ParsedArgs): ArtifactType {
  return requiredFlag(parsed, "type") as ArtifactType;
}

function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function markdown(command: string, payload: unknown): string {
  if (command === "get-task-context") {
    const context = payload as { requirement?: { id?: string; title?: string; status?: string } };
    return `# Task Context\nRequirement: ${context.requirement?.id}\nTitle: ${context.requirement?.title}\nStatus: ${context.requirement?.status}\n`;
  }
  return `# Proud Flow Result\n${JSON.stringify(payload, null, 2)}\n`;
}

function formatError(error: unknown, asJson: boolean): string {
  if (error instanceof ProudFlowApiError) {
    const payload = { error: { code: error.code, message: error.message } };
    return asJson ? json(payload) : `${error.code}: ${error.message}\n`;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  const payload = { error: { code: "INTERNAL_ERROR", message } };
  return asJson ? json(payload) : `INTERNAL_ERROR: ${message}\n`;
}
