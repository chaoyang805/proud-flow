import { createProudFlowApiClient } from "@proud-flow/api-client";
import { getBackendUrl, isEnvironment } from "../environment";
import type { CliConfig, CliRuntime } from "../runtime";
import {
  installSkills,
  loadBundledManifest,
  resolveSkillInstallRoot,
} from "../skills/installer";
import { isJsonMode, json } from "../cli/output";

export interface InitOptions {
  env?: string;
  machineName?: string;
  bootstrapToken?: string;
  json?: boolean;
}

export async function runInit(
  runtime: CliRuntime,
  options: InitOptions,
): Promise<string> {
  const environment = options.env ?? "prod";
  if (!isEnvironment(environment)) throw new Error("Invalid environment");
  const machineName = options.machineName ?? "local-machine";
  const bootstrapToken = options.bootstrapToken;
  if (!bootstrapToken) throw new Error("Missing --bootstrap-token");
  const client = createProudFlowApiClient({
    baseUrl: getBackendUrl(environment, runtime.env),
    fetch: runtime.fetch,
  });
  const response = await client.local.bootstrap({
    bootstrapToken,
    machineName,
  });
  const config: CliConfig = {
    environment,
    machineName,
    workspacePath: runtime.cwd,
  };
  await runtime.store.writeConfig(config);
  await runtime.keychain.setToken("skill", response.tokens.skill);
  await runtime.keychain.setToken("dispatcher", response.tokens.dispatcher);
  await runtime.keychain.setToken("local", response.tokens.local);
  const manifest = loadBundledManifest();
  const skillInstall = await installSkills(runtime, manifest, { config });
  const skillInstallRoot = resolveSkillInstallRoot(config);
  if (isJsonMode(options)) {
    return json({
      initialized: true,
      environment,
      machineName,
      skillInstallRoot,
      skillsInstalled: skillInstall.installed.map((item) => item.name),
      skillsSkipped: skillInstall.skipped,
    });
  }
  const installedNames =
    skillInstall.installed.map((item) => item.name).join(", ") || "none";
  return `Initialized Proud Flow CLI for ${environment}\nInstalled Skills to ${skillInstallRoot}: ${installedNames}\n`;
}
