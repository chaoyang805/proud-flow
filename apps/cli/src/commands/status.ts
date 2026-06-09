import type { CliRuntime } from "../runtime";
import { requireConfig } from "../cli/clients";
import { isJsonMode, json } from "../cli/output";

export interface StatusOptions {
  json?: boolean;
}

export async function runStatus(
  runtime: CliRuntime,
  options: StatusOptions,
): Promise<string> {
  const config = await requireConfig(runtime);
  const authenticated = Boolean(await runtime.keychain.getToken("skill"));
  const payload = {
    environment: config.environment ?? "prod",
    workspacePath: config.workspacePath,
    authenticated,
  };
  return isJsonMode(options)
    ? json(payload)
    : `Proud Flow CLI\nEnvironment: ${payload.environment}\nAuthenticated: ${payload.authenticated ? "yes" : "no"}\n`;
}
