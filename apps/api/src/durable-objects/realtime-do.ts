import { DurableObject } from "cloudflare:workers";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { realtimeEventSchema } from "@proud-flow/api-contract";
import type { RealtimeEvent } from "@proud-flow/domain";
import { DO_PATH_BROADCAST, DO_PATH_WS, getDoPath } from "./do-request";
declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
} | undefined;

export interface RealtimeDoEnv {
  REALTIME_DO?: DurableObjectNamespace;
}

export class RealtimeDurableObject extends DurableObject<RealtimeDoEnv> {
  private clients = new Set<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    const path = getDoPath(request);

    if (path === DO_PATH_BROADCAST && request.method === "POST") {
      return this.handleBroadcast(request);
    }

    if (path === DO_PATH_WS && request.method === "GET") {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const event = realtimeEventSchema.parse(await request.json());
    this.broadcast(event);
    return Response.json({ ok: true });
  }

  private handleWebSocketUpgrade(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (typeof WebSocketPair === "undefined") {
      return new Response("WebSocket runtime unavailable", { status: 501 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    this.clients.add(server);
    console.log(
      `[realtime-do] client connected (total: ${this.clients.size})`,
    );

    const remove = () => {
      if (!this.clients.has(server)) return;
      this.clients.delete(server);
      console.log(
        `[realtime-do] client disconnected (remaining: ${this.clients.size})`,
      );
    };

    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }

  broadcast(event: RealtimeEvent): void {
    const payload = JSON.stringify(event);
    console.log(
      `[realtime-do] broadcasting type=${event.type} eventId=${event.eventId}`,
    );
    for (const client of this.clients) {
      try {
        client.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}
