import type { ApiEnv } from "../../env";
import { requireDispatcherToken } from "../../middleware/auth";
import type { InMemoryRequirementRepository } from "../requirements/repository";

type WorkerWebSocket = {
  accept(): void;
  send(message: string): void;
};

type WebSocketPairConstructor = new () => {
  0: WorkerWebSocket;
  1: WorkerWebSocket;
};

declare const WebSocketPair: WebSocketPairConstructor | undefined;

export async function handleDispatchRoute(
  request: Request,
  pathname: string,
  env: ApiEnv,
  repository: InMemoryRequirementRepository,
): Promise<Response | undefined> {
  if (pathname !== "/api/dispatch/ws" || request.method !== "GET") {
    return undefined;
  }

  await requireDispatcherToken(request, env, repository);

  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }

  if (typeof WebSocketPair === "undefined") {
    return new Response("WebSocket runtime unavailable", { status: 501 });
  }

  /* v8 ignore start -- Cloudflare Worker WebSocket upgrade path is not constructible with Node Response. */
  const pair = new WebSocketPair();
  pair[1].accept();
  pair[1].send(
    JSON.stringify({ type: "dispatcher.ping", timestamp: new Date().toISOString() }),
  );
  return new Response(null, {
    status: 101,
    webSocket: pair[0],
  } as ResponseInit);
  /* v8 ignore stop */
}
