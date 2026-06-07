import { Buffer } from "node:buffer";
import {
  createProudFlowApiClient,
  ProudFlowApiError,
} from "@proud-flow/api-client";
import type { ArtifactType, DispatchStage } from "@proud-flow/domain";
import { createMockCodexRunner } from "./daemon/codex-runner";
import { createDaemon } from "./daemon/daemon";
import { getBackendUrl, isEnvironment } from "./environment";
import type { CliConfig, CliRuntime, StoredTokenType } from "./runtime";
import { getSkillStatuses, installSkills } from "./skills/installer";

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
  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("dispatcher");
  if (!token) throw new Error("Missing dispatcher token");
  if (parsed.flags.once === true) {
    return daemonOnceCommand(parsed, runtime, token);
  }
  const payload = {
    ready: true,
    environment: config.environment ?? "prod",
    websocketUrl: `${getBackendUrl(
      config.environment ?? "prod",
      runtime.env,
    ).replace(/^http/, "ws")}/api/dispatch/ws`,
  };
  return parsed.json
    ? json(payload)
    : `Proud Flow daemon ready\nEnvironment: ${payload.environment}\n`;
}

async function daemonOnceCommand(
  parsed: ParsedArgs,
  runtime: CliRuntime,
  token: string,
): Promise<string> {
  const client = await createDispatcherClient(runtime, token);
  const runner = createMockCodexRunner();
  let acked = false;
  const daemon = createDaemon({
    runner,
    send: async (message) => {
      if (message.type === "dispatch.acked") {
        await client.dispatch.ack(message);
        acked = true;
      }
    },
  });
  const next = await client.dispatch.next();
  if ("empty" in next) {
    const payload = { processed: false, empty: true };
    return parsed.json ? json(payload) : "No pending dispatch request\n";
  }
  await daemon.receive(next);
  const payload = {
    processed: true,
    acknowledged: acked,
    requestId: next.requestId,
    requirementId: next.requirementId,
    stage: next.stage,
    command: runner.calls[0]?.command,
  };
  return parsed.json
    ? json(payload)
    : `Processed dispatch ${payload.requestId}: ${payload.command}\n`;
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
      ((command[0] === "auth" || command[0] === "skill") && command.length === 1)
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
