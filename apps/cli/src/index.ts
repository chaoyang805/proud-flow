import { createProudFlowApiClient } from "@proud-flow/api-client";

export const cliApp = {
  name: "@proud-flow/cli",
  createsClient: typeof createProudFlowApiClient === "function",
} as const;

export function canCreateCliApiClient(): boolean {
  return cliApp.createsClient;
}
