import { ProudFlowApiError } from "@proud-flow/api-client";
import type { CliRuntime, StoredTokenType } from "../runtime";
import { createLocalClient } from "../cli/clients";
import { isJsonMode, json } from "../cli/output";

const REINIT_HINT =
  "Re-run `proud-flow init --bootstrap-token <token>` (local credentials are missing or no longer accepted by the API).";

export interface AuthStatusOptions {
  json?: boolean;
}

export async function runAuthStatus(
  runtime: CliRuntime,
  options: AuthStatusOptions,
): Promise<string> {
  const payload = {
    authenticated: Boolean(await runtime.keychain.getToken("skill")),
    hasDispatcherToken: Boolean(await runtime.keychain.getToken("dispatcher")),
    hasLocalToken: Boolean(await runtime.keychain.getToken("local")),
  };
  return isJsonMode(options)
    ? json(payload)
    : `Authenticated: ${payload.authenticated ? "yes" : "no"}\n`;
}

export interface AuthRotateOptions {
  type?: string;
  json?: boolean;
}

export async function runAuthRotate(
  runtime: CliRuntime,
  options: AuthRotateOptions,
): Promise<string> {
  const tokenType = (options.type ?? "skill") as StoredTokenType;
  if (!["skill", "dispatcher", "local"].includes(tokenType)) {
    throw new Error("Invalid token type");
  }
  try {
    const client = await createLocalClient(runtime);
    const response = await client.local.rotateToken({ tokenType });
    await runtime.keychain.setToken(tokenType, response.token);
    return isJsonMode(options)
      ? json({ rotated: tokenType })
      : `Rotated ${tokenType} token\n`;
  } catch (error) {
    if (error instanceof Error && error.message === "Missing local token") {
      throw new Error(REINIT_HINT);
    }
    if (
      error instanceof ProudFlowApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw new Error(REINIT_HINT);
    }
    throw error;
  }
}

export async function runAuthLogout(runtime: CliRuntime): Promise<string> {
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
