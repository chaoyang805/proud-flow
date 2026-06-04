import process from "node:process";

export type ProudFlowEnvironment = "prod" | "dev";

const backendUrls: Record<ProudFlowEnvironment, string> = {
  prod: "https://api.proud-flow.example",
  dev: "http://127.0.0.1:8787",
};

export function getBackendUrl(
  environment: ProudFlowEnvironment,
  env: Record<string, string | undefined> = process.env,
): string {
  return env.PROUD_FLOW_API_URL ?? backendUrls[environment];
}

export function isEnvironment(value: string): value is ProudFlowEnvironment {
  return value === "prod" || value === "dev";
}
