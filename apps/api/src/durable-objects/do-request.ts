export const DO_INTERNAL_ORIGIN = "https://proud-flow.do.internal";

export const DO_PATH_WS = "/ws";
export const DO_PATH_STATUS = "/status";
export const DO_PATH_DISPATCH = "/dispatch";
export const DO_PATH_BROADCAST = "/broadcast";

export const DISPATCH_DO_NAME = "dispatch";
export const REALTIME_DO_NAME = "realtime";

export const DISPATCH_ACK_TIMEOUT_MS = 5_000;
export const DISPATCH_PING_INTERVAL_MS = 30_000;
export const DISPATCH_PONG_TIMEOUT_MS = 10_000;

export function createDoRequest(
  path: string,
  init: RequestInit = {},
): Request {
  return new Request(`${DO_INTERNAL_ORIGIN}${path}`, init);
}

export function getDoPath(request: Request): string {
  return new URL(request.url).pathname;
}
