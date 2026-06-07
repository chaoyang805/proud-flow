import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { InMemoryRequirementRepository } from "../requirements/repository";

declare const WebSocketPair: { new(): { 0: WebSocket; 1: WebSocket } } | undefined;

export async function handleRealtimeRoute(
  request: Request,
  pathname: string,
  env: ApiEnv,
  repository: InMemoryRequirementRepository,
): Promise<Response | undefined> {
  if (pathname === "/api/realtime/events" && request.method === "GET") {
    return jsonResponse({ items: repository.listRealtimeEvents() });
  }

  if (pathname === "/api/realtime/ws" && request.method === "GET") {
    await requireUserToken(request, env);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (typeof WebSocketPair === "undefined") {
      return new Response("WebSocket runtime unavailable", { status: 501 });
    }
    /* v8 ignore start -- Cloudflare Worker WebSocketPair not constructible in Node */
    const pair = new WebSocketPair();
    const unregister = repository.registerWsClient((event) => {
      pair[1].send(JSON.stringify(event));
    });
    pair[1].accept();
    pair[1].addEventListener("close", () => unregister());
    pair[1].addEventListener("error", () => unregister());
    return new Response(null, {
      status: 101,
      webSocket: pair[0],
    } as ResponseInit);
    /* v8 ignore stop */
  }

  return undefined;
}
