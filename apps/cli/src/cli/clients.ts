import { createProudFlowApiClient } from "@proud-flow/api-client";
import { getBackendUrl } from "../environment";
import type { CliConfig, CliRuntime } from "../runtime";

export async function requireConfig(runtime: CliRuntime): Promise<CliConfig> {
  const config = await runtime.store.readConfig();
  if (!config) throw new Error("Proud Flow CLI is not initialized");
  return config;
}

export async function createLocalClient(runtime: CliRuntime) {
  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("local");
  if (!token) throw new Error("Missing local token");
  return createProudFlowApiClient({
    baseUrl: getBackendUrl(config.environment ?? "prod", runtime.env),
    token,
    fetch: runtime.fetch,
  });
}

export async function createSkillClient(runtime: CliRuntime) {
  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("skill");
  if (!token) throw new Error("Missing skill token");
  return createProudFlowApiClient({
    baseUrl: getBackendUrl(config.environment ?? "prod", runtime.env),
    token,
    fetch: runtime.fetch,
  });
}
