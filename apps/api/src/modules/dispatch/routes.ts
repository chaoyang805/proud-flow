import {
  dispatchAckedMessageSchema,
  dispatchRequirementRequestSchema,
} from "@proud-flow/api-contract";
import {
  getActiveStatusForDispatchStage,
  type DispatchStage,
  type RequirementStatus,
} from "@proud-flow/domain";
import type { ApiEnv } from "../../env";
import { requireDispatcherToken } from "../../middleware/auth";
import { ApiError, jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import type { RealtimeHub } from "../realtime/hub";

type WorkerWebSocket = {
  accept(): void;
  send(message: string): void;
  addEventListener(type: string, fn: (event: Event) => void): void;
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
  repository: IRequirementRepository,
  hub: RealtimeHub,
): Promise<Response | undefined> {
  // POST /api/requirements/:id/dispatch — push task to connected daemon via WS
  const dispatchMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/dispatch$/,
  );
  if (dispatchMatch && request.method === "POST") {
    const body = dispatchRequirementRequestSchema.parse(await request.json());
    const requirement = await repository.getRequirement(dispatchMatch[1]);
    if (!requirement) {
      console.log(`[dispatch] requirement ${dispatchMatch[1]} not found`);
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    }
    console.log(`[dispatch] pushing task to daemon: requirement=${requirement.id} stage=${body.stage}`);
    ensureDispatchAllowed(requirement.status, body.stage);

    if (!hub.hasDispatchClient()) {
      console.log(`[dispatch] no daemon connected`);
      throw new ApiError(503, "DISPATCHER_OFFLINE", "No dispatch daemon connected");
    }

    const requestId = `dispatch_req_${Date.now().toString(36)}`;
    hub.sendToDispatchClient({
      type: "dispatch.requested",
      requestId,
      requirementId: requirement.id,
      stage: body.stage,
    });
    console.log(`[dispatch] task pushed to daemon: requestId=${requestId}`);
    return jsonResponse({
      requestId,
      stage: body.stage,
      accepted: true,
    });
  }

  // WS /api/dispatch/ws — daemon connects here
  if (pathname !== "/api/dispatch/ws" || request.method !== "GET") {
    return undefined;
  }

  console.log("[dispatch] ws: WebSocket upgrade request");
  await requireDispatcherToken(request, env, repository);
  console.log("[dispatch] ws: dispatcher token valid");

  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    console.log("[dispatch] ws: not a WebSocket upgrade, returning 426");
    return new Response("WebSocket upgrade required", { status: 426 });
  }

  if (typeof WebSocketPair === "undefined") {
    console.log("[dispatch] ws: WebSocketPair not available");
    return new Response("WebSocket runtime unavailable", { status: 501 });
  }

  /* v8 ignore start */
  const pair = new WebSocketPair();
  const serverWs = pair[1] as any;
  serverWs.accept();

  const unregister = hub.registerDispatchClient((msg) => {
    try {
      serverWs.send(JSON.stringify(msg));
      console.log(`[dispatch] ws: pushed task to daemon: requestId=${msg.requestId}`);
    } catch (err) {
      console.log(`[dispatch] ws: send failed, unregistering: ${err}`);
      unregister();
    }
  });

  serverWs.addEventListener("message", (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string);
      if (data.type === "dispatch.acked") {
        const ack = dispatchAckedMessageSchema.parse(data);
        console.log(`[dispatch] ws: received ACK from daemon: requestId=${ack.requestId} success=${ack.success}`);
        hub.broadcast({
          type: "dispatch.acked",
          eventId: `evt_${Date.now().toString(36)}`,
          requirementId: "unknown",
          success: ack.success,
          message: ack.success ? "Dispatch acknowledged" : (ack.errorMessage ?? "Dispatch failed"),
        });
      }
    } catch (err) {
      console.log(`[dispatch] ws: invalid message from daemon: ${err}`);
    }
  });

  serverWs.addEventListener("close", () => {
    console.log("[dispatch] ws: daemon disconnected");
    unregister();
  });

  serverWs.addEventListener("error", (err: Event) => {
    console.log(`[dispatch] ws: daemon error, unregistering: ${err}`);
    unregister();
  });

  serverWs.send(
    JSON.stringify({ type: "dispatcher.ping", timestamp: new Date().toISOString() }),
  );
  console.log("[dispatch] ws: daemon connected");

  return new Response(null, {
    status: 101,
    webSocket: pair[0],
  } as ResponseInit);
  /* v8 ignore stop */
}

function ensureDispatchAllowed(
  status: RequirementStatus,
  stage: DispatchStage,
): void {
  const allowedSource = getDispatchSourceStatus(stage);
  if (status !== allowedSource) {
    throw new ApiError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot dispatch ${stage} from ${status}`,
    );
  }
  getActiveStatusForDispatchStage(stage);
}

function getDispatchSourceStatus(stage: DispatchStage): RequirementStatus {
  if (stage === "tech_design") return "planning";
  if (stage === "case_rundown") return "case-rundown";
  return "developing";
}
