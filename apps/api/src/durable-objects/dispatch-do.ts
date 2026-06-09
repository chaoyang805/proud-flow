import { DurableObject } from "cloudflare:workers";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import {
  dispatchAckedMessageSchema,
  dispatchRequestedMessageSchema,
  type DispatchPushResponse,
} from "@proud-flow/api-contract";
import type { DispatchRequestedMessage } from "@proud-flow/domain";
import {
  DISPATCH_ACK_TIMEOUT_MS,
  DISPATCH_PING_INTERVAL_MS,
  DISPATCH_PONG_TIMEOUT_MS,
  DO_PATH_DISPATCH,
  DO_PATH_STATUS,
  DO_PATH_WS,
  getDoPath,
  REALTIME_DO_NAME,
} from "./do-request";
import type { DoStub } from "./fetch-do";
import { broadcastRealtimeViaDo } from "./realtime-client";

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
} | undefined;

interface DaemonSession {
  ws: WebSocket;
  lastPongAt: number;
  awaitingPong: boolean;
}

interface PendingAck {
  requirementId: string;
  resolve: (ack: DispatchPushResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface DispatchDoEnv {
  REALTIME_DO?: DurableObjectNamespace;
}

export class DispatchDurableObject extends DurableObject<DispatchDoEnv> {
  private sessions = new Map<WebSocket, DaemonSession>();
  private pendingAcks = new Map<string, PendingAck>();
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  async fetch(request: Request): Promise<Response> {
    const path = getDoPath(request);

    if (path === DO_PATH_WS && request.method === "GET") {
      return this.handleWebSocketUpgrade(request);
    }

    if (path === DO_PATH_STATUS && request.method === "GET") {
      return Response.json({
        online: this.sessions.size > 0,
        connectionCount: this.sessions.size,
      });
    }

    if (path === DO_PATH_DISPATCH && request.method === "POST") {
      return this.handleDispatchPush(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private handleWebSocketUpgrade(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (typeof WebSocketPair === "undefined") {
      return new Response("WebSocket runtime unavailable", { status: 501 });
    }

    for (const [ws] of this.sessions) {
      try {
        ws.close(1000, "replaced by newer daemon connection");
      } catch {
        /* ignore */
      }
      this.sessions.delete(ws);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const now = Date.now();
    const session: DaemonSession = {
      ws: server,
      lastPongAt: now,
      awaitingPong: false,
    };
    this.sessions.set(server, session);
    console.log(`[dispatch-do] daemon connected (total: ${this.sessions.size})`);

    this.ensurePingTimer();

    server.addEventListener("message", (event: MessageEvent) => {
      this.handleDaemonMessage(server, String(event.data));
    });

    const remove = () => {
      if (!this.sessions.has(server)) return;
      this.sessions.delete(server);
      console.log(
        `[dispatch-do] daemon disconnected (remaining: ${this.sessions.size})`,
      );
      if (this.sessions.size === 0) {
        this.clearPingTimer();
      }
    };

    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    server.send(
      JSON.stringify({
        type: "dispatcher.ping",
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }

  private handleDaemonMessage(ws: WebSocket, raw: string): void {
    try {
      const data = JSON.parse(raw) as { type?: string };
      if (data.type === "dispatcher.pong") {
        const session = this.sessions.get(ws);
        if (session) {
          session.lastPongAt = Date.now();
          session.awaitingPong = false;
        }
        return;
      }

      if (data.type === "dispatch.acked") {
        const ack = dispatchAckedMessageSchema.parse(data);
        const pending = this.pendingAcks.get(ack.requestId);
        if (!pending) return;

        clearTimeout(pending.timer);
        this.pendingAcks.delete(ack.requestId);

        void this.broadcastDispatchAck(pending.requirementId, ack.success, ack.errorMessage);

        pending.resolve({
          accepted: true,
          requestId: ack.requestId,
          ack: {
            success: ack.success,
            errorMessage: ack.errorMessage,
          },
        });
      }
    } catch {
      /* invalid message */
    }
  }

  private async broadcastDispatchAck(
    requirementId: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    const namespace = this.env.REALTIME_DO;
    if (!namespace) return;

    const stub = namespace.get(
      namespace.idFromName(REALTIME_DO_NAME),
    ) as unknown as DoStub;
    await broadcastRealtimeViaDo(stub, {
      type: "dispatch.acked",
      eventId: `evt_${Date.now().toString(36)}`,
      requirementId,
      success,
      message: success
        ? "Codex 已收到派发指令"
        : (errorMessage ?? "派发失败"),
    });
  }

  private async handleDispatchPush(request: Request): Promise<Response> {
    const message = dispatchRequestedMessageSchema.parse(await request.json());

    const session = this.getActiveSession();
    if (!session) {
      const offline: DispatchPushResponse = {
        accepted: false,
        code: "DISPATCHER_OFFLINE",
      };
      return Response.json(offline);
    }

    const result = await this.pushAndWaitForAck(session, message);
    return Response.json(result);
  }

  private getActiveSession(): DaemonSession | undefined {
    return this.sessions.values().next().value;
  }

  private pushAndWaitForAck(
    session: DaemonSession,
    message: DispatchRequestedMessage,
  ): Promise<DispatchPushResponse> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(message.requestId);
        resolve({
          accepted: false,
          code: "DISPATCH_TIMEOUT",
        });
      }, DISPATCH_ACK_TIMEOUT_MS);

      this.pendingAcks.set(message.requestId, {
        requirementId: message.requirementId,
        resolve,
        timer,
      });

      try {
        session.ws.send(JSON.stringify(message));
        console.log(
          `[dispatch-do] pushed dispatch.requested requestId=${message.requestId}`,
        );
      } catch {
        clearTimeout(timer);
        this.pendingAcks.delete(message.requestId);
        this.sessions.delete(session.ws);
        resolve({
          accepted: false,
          code: "DISPATCHER_OFFLINE",
        });
      }
    });
  }

  private ensurePingTimer(): void {
    if (this.pingTimer) return;

    this.pingTimer = setInterval(() => {
      const now = Date.now();
      for (const [ws, session] of this.sessions) {
        if (
          session.awaitingPong &&
          now - session.lastPongAt > DISPATCH_PONG_TIMEOUT_MS
        ) {
          console.log("[dispatch-do] pong timeout, closing daemon connection");
          try {
            ws.close(1000, "pong timeout");
          } catch {
            /* ignore */
          }
          this.sessions.delete(ws);
          continue;
        }

        session.awaitingPong = true;
        try {
          ws.send(
            JSON.stringify({
              type: "dispatcher.ping",
              timestamp: new Date().toISOString(),
            }),
          );
        } catch {
          this.sessions.delete(ws);
        }
      }

      if (this.sessions.size === 0) {
        this.clearPingTimer();
      }
    }, DISPATCH_PING_INTERVAL_MS);
  }

  private clearPingTimer(): void {
    if (!this.pingTimer) return;
    clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }
}
