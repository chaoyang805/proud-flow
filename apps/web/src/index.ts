import { createProudFlowApiClient } from "@proud-flow/api-client";

export const webApp = {
  name: "@proud-flow/web",
  createsClient: typeof createProudFlowApiClient === "function",
} as const;

export function canCreateWebApiClient(): boolean {
  return webApp.createsClient;
}
