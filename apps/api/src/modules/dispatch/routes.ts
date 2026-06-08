import {
  dispatchAckedMessageSchema,
  dispatchRequirementRequestSchema,
} from "@proud-flow/api-contract";
import {
  getActiveStatusForDispatchStage,
  type DispatchStage,
  type RequirementStatus,
} from "@proud-flow/domain";
import { type IRequestStrict, Router, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireDispatcherToken, requireUserToken } from "../../middleware/auth";
import { ApiError, jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import type { RealtimeHub } from "../realtime/hub";

declare const WebSocketPair: { new(): { 0: WebSocket; 1: WebSocket } } | undefined;

export function installDispatchModule(
  router: RouterType,
  repository: IRequirementRepository,
  hub: RealtimeHub,
) {
  // POST /api/requirements/:id/dispatch — push task to daemon (user auth)
  router.post("/api/requirements/:id/dispatch", async (request: IRequestStrict, env: ApiEnv) => {
    await requireUserToken(request, env);
    const body = dispatchRequirementRequestSchema.parse(await request.json());
    const requirement = await repository.getRequirement(request.params.id);
    if (!requirement) {
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    }
    console.log(`[dispatch] pushing task to daemon: requirement=${requirement.id} stage=${body.stage}`);
    ensureDispatchAllowed(requirement.status, body.stage);

    if (!hub.hasDispatchClient()) {
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
    return jsonResponse({ requestId, stage: body.stage, accepted: true });
  });

  // GET /api/dispatch/ws — daemon connects here (dispatcher token auth)
  router.get("/api/dispatch/ws", async (request: IRequestStrict, env: ApiEnv) => {
    console.log("[dispatch] ws: WebSocket upgrade request");

    await requireDispatcherToken(request, env, repository);

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

    const unregister = hub.registerDispatchClient((msg) => {
      try {
        serverWs.send(JSON.stringify(msg));
      } catch {
        unregister();
      }
    });

    serverWs.addEventListener("message", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "dispatch.acked") {
          const ack = dispatchAckedMessageSchema.parse(data);
          hub.broadcast({
            type: "dispatch.acked",
            eventId: `evt_${Date.now().toString(36)}`,
            requirementId: "unknown",
            success: ack.success,
            message: ack.success ? "Dispatch acknowledged" : (ack.errorMessage ?? "Dispatch failed"),
          });
        }
      } catch { /* invalid message */ }
    });

    serverWs.addEventListener("close", () => unregister());
    serverWs.addEventListener("error", () => unregister());

    serverWs.send(JSON.stringify({ type: "dispatcher.ping", timestamp: new Date().toISOString() }));
    console.log("[dispatch] ws: daemon connected");

    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
    /* v8 ignore stop */
  });
}

function ensureDispatchAllowed(status: RequirementStatus, stage: DispatchStage): void {
  const allowedSource = getDispatchSourceStatus(stage);
  if (status !== allowedSource) {
    throw new ApiError(409, "INVALID_STATUS_TRANSITION", `Cannot dispatch ${stage} from ${status}`);
  }
  getActiveStatusForDispatchStage(stage);
}

function getDispatchSourceStatus(stage: DispatchStage): RequirementStatus {
  if (stage === "tech_design") return "planning";
  if (stage === "case_rundown") return "case-rundown";
  return "developing";
}
