import { Router, type IRequestStrict, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import type { RealtimeHub } from "./hub";

declare const WebSocketPair: { new(): { 0: WebSocket; 1: WebSocket } } | undefined;

export function installRealtimeModule(
  router: RouterType,
  hub: RealtimeHub,
) {
  router.get("/api/realtime/ws", async (request: IRequestStrict, env: ApiEnv) => {
    await requireUserToken(request, env);

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (typeof WebSocketPair === "undefined") {
      return new Response("WebSocket runtime unavailable", { status: 501 });
    }

    /* v8 ignore start */
    const pair = new WebSocketPair();
    const serverWs = pair[1] as any;
    serverWs.accept();

    const unregister = hub.registerRealtimeClient((event) => {
      try {
        serverWs.send(JSON.stringify(event));
      } catch {
        unregister();
      }
    });

    serverWs.addEventListener("close", () => unregister());
    serverWs.addEventListener("error", () => unregister());

    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
    /* v8 ignore stop */
  });
}
