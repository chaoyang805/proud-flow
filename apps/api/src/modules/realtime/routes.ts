import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { RealtimeHub } from "./hub";

declare const WebSocketPair: { new(): { 0: WebSocket; 1: WebSocket } } | undefined;

export async function handleRealtimeRoute(
  request: Request,
  pathname: string,
  env: ApiEnv,
  hub: RealtimeHub,
): Promise<Response | undefined> {
  if (pathname === "/api/realtime/events" && request.method === "GET") {
    console.log("[realtime] listing events");
    return jsonResponse({ items: hub.listRealtimeEvents() });
  }

  if (pathname === "/api/realtime/ws" && request.method === "GET") {
    console.log("[realtime] ws: WebSocket upgrade request");
    await requireUserToken(request, env);
    console.log("[realtime] ws: user token valid");
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      console.log("[realtime] ws: not a WebSocket upgrade, returning 426");
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (typeof WebSocketPair === "undefined") {
      console.log("[realtime] ws: WebSocketPair not available");
      return new Response("WebSocket runtime unavailable", { status: 501 });
    }
    /* v8 ignore start */
    const pair = new WebSocketPair();
    console.log("[realtime] ws: WebSocket connection established, registering client");
    const serverWs = pair[1] as any;
    serverWs.accept();
    const unregister = hub.registerRealtimeClient((event) => {
      try {
        serverWs.send(JSON.stringify(event));
        console.log(`[realtime] ws: sent event type=${event.type} requirementId=${(event as any).requirementId ?? "unknown"}`);
      } catch (err) {
        console.log(`[realtime] ws: send failed, unregistering: ${err}`);
        unregister();
      }
    });
    serverWs.addEventListener("close", () => {
      console.log("[realtime] ws: client disconnected");
      unregister();
    });
    serverWs.addEventListener("error", (err: Event) => {
      console.log(`[realtime] ws: client error, unregistering: ${err}`);
      unregister();
    });
    return new Response(null, {
      status: 101,
      webSocket: pair[0],
    } as ResponseInit);
    /* v8 ignore stop */
  }

  return undefined;
}
