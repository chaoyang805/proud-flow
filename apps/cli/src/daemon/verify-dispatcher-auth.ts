import { getBackendUrl, type ProudFlowEnvironment } from "../environment";

export const AUTH_FAILED_CODE = "AUTH_FAILED";

export class DispatcherAuthError extends Error {
  readonly code: string;
  /** Set when the error was already written to a daemon logger. */
  readonly logged: boolean;

  constructor(
    message: string,
    code: string = AUTH_FAILED_CODE,
    logged = false,
  ) {
    super(message);
    this.name = "DispatcherAuthError";
    this.code = code;
    this.logged = logged;
  }
}

export interface VerifyDispatcherAuthOptions {
  environment: ProudFlowEnvironment | string;
  env: Record<string, string | undefined>;
  token: string;
  fetch?: typeof fetch;
}

function buildAuthCheckUrl(
  environment: string,
  env: Record<string, string | undefined>,
  token: string,
): string {
  const backend = getBackendUrl(environment as ProudFlowEnvironment, env);
  return `${backend}/api/dispatch/ws?token=${encodeURIComponent(token)}`;
}

export async function verifyDispatcherAuth(
  opts: VerifyDispatcherAuthOptions,
): Promise<void> {
  const fetchFn = opts.fetch ?? fetch;
  const url = buildAuthCheckUrl(opts.environment, opts.env, opts.token);

  let response: Response;
  try {
    response = await fetchFn(url, { method: "GET" });
  } catch (error) {
    const backend = getBackendUrl(
      opts.environment as ProudFlowEnvironment,
      opts.env,
    );
    throw new DispatcherAuthError(
      `Cannot reach API at ${backend}: ${error instanceof Error ? error.message : String(error)}`,
      "API_UNREACHABLE",
    );
  }

  if (response.status === 426) {
    return;
  }

  if (response.status === 401 || response.status === 403) {
    throw new DispatcherAuthError(
      `${AUTH_FAILED_CODE}: Invalid dispatcher token. If your local token is still valid, run \`proud-flow auth rotate --type dispatcher\`; otherwise re-run \`proud-flow init --bootstrap-token <token>\` (for example after clearing local D1 or revoking tokens).`,
    );
  }

  throw new DispatcherAuthError(
    `Unexpected API response (${response.status}) from ${url}`,
    "AUTH_CHECK_FAILED",
  );
}
