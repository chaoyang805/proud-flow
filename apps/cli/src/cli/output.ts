import { ProudFlowApiError } from "@proud-flow/api-client";
import { DispatcherAuthError } from "../daemon/verify-dispatcher-auth";

export function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function markdown(command: string, payload: unknown): string {
  if (command === "get-task-context") {
    const context = payload as {
      requirement?: { id?: string; title?: string; status?: string };
    };
    return `# Task Context\nRequirement: ${context.requirement?.id}\nTitle: ${context.requirement?.title}\nStatus: ${context.requirement?.status}\n`;
  }
  return `# Proud Flow Result\n${JSON.stringify(payload, null, 2)}\n`;
}

export function formatError(error: unknown, asJson: boolean): string {
  if (error instanceof ProudFlowApiError) {
    const payload = { error: { code: error.code, message: error.message } };
    return asJson ? json(payload) : `${error.code}: ${error.message}\n`;
  }
  if (error instanceof DispatcherAuthError) {
    if (error.logged && !asJson) {
      return "";
    }
    const payload = { error: { code: error.code, message: error.message } };
    return asJson ? json(payload) : `${error.code}: ${error.message}\n`;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  const payload = { error: { code: "INTERNAL_ERROR", message } };
  return asJson ? json(payload) : `INTERNAL_ERROR: ${message}\n`;
}

export function isJsonMode(opts: { json?: boolean }): boolean {
  return opts.json === true;
}
