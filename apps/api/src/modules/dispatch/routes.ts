import {
  dispatchAckedMessageSchema,
  dispatchRequirementRequestSchema,
  type DispatchRequirementResponse,
} from "@proud-flow/api-contract";
import {
  getActiveStatusForDispatchStage,
  type DispatchStage,
  type RequirementStatus,
} from "@proud-flow/domain";
import { type IRequestStrict, Router, type RouterType } from "itty-router";
import { createDoRequest, DO_PATH_WS } from "../../durable-objects/do-request";
import { pushDispatchViaDo } from "../../durable-objects/dispatch-client";
import { fetchDo } from "../../durable-objects/fetch-do";
import { getDispatchStub, hasDoBindings } from "../../durable-objects/stubs";
import type { ApiEnv } from "../../env";
import { requireDispatcherToken, requireUserToken } from "../../middleware/auth";
import { ApiError, jsonResponse } from "../../middleware/error";
import { broadcastRealtimeEvent } from "../realtime/broadcast";
import type { RealtimeHub } from "../realtime/hub";
import type { IRequirementRepository } from "../requirements/repository";

declare const WebSocketPair: { new(): { 0: WebSocket; 1: WebSocket } } | undefined;

export function installDispatchModule(
  router: RouterType,
  repository: IRequirementRepository,
  hub: RealtimeHub,
) {
  router.post("/api/requirements/:id/dispatch", async (request: IRequestStrict, env: ApiEnv) => {
    await requireUserToken(request, env);
    const body = dispatchRequirementRequestSchema.parse(await request.json());
    const requirement = await repository.getRequirement(request.params.id);
    if (!requirement) {
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    }
    console.log(`[dispatch] pushing task to daemon: requirement=${requirement.id} stage=${body.stage}`);
    ensureDispatchAllowed(requirement.status, body.stage);

    const requestId = `dispatch_req_${Date.now().toString(36)}`;
    const message = {
      type: "dispatch.requested" as const,
      requestId,
      requirementId: requirement.id,
      stage: body.stage,
    };

    if (hasDoBindings(env)) {
      const pushResult = await pushDispatchViaDo(getDispatchStub(env), message);

      if (!pushResult.accepted) {
        if (pushResult.code === "DISPATCH_TIMEOUT") {
          throw new ApiError(504, "DISPATCH_TIMEOUT", "Dispatch daemon did not ACK in time");
        }
        throw new ApiError(503, "DISPATCHER_OFFLINE", "No dispatch daemon connected");
      }

      const response: DispatchRequirementResponse = {
        requestId,
        stage: body.stage,
        accepted: pushResult.ack.success,
        ack: pushResult.ack,
      };
      console.log(
        `[dispatch] task pushed to daemon: requestId=${requestId} ackSuccess=${pushResult.ack.success}`,
      );
      return jsonResponse(response);
    }

    if (!hub.hasDispatchClient()) {
      throw new ApiError(503, "DISPATCHER_OFFLINE", "No dispatch daemon connected");
    }

    hub.sendToDispatchClient(message);
    console.log(`[dispatch] task pushed to daemon: requestId=${requestId}`);
    return jsonResponse({
      requestId,
      stage: body.stage,
      accepted: true,
    } satisfies DispatchRequirementResponse);
  });

  router.get("/api/dispatch/ws", async (request: IRequestStrict, env: ApiEnv) => {
    const url = new URL(request.url);
    console.log(`[dispatch] ws: incoming request, upgrade=${request.headers.get("Upgrade")}, token=${url.searchParams.get("token")?.substring(0, 12)}...`);

    await requireDispatcherToken(request, env, repository);

    if (hasDoBindings(env)) {
      return fetchDo(
        getDispatchStub(env),
        createDoRequest(DO_PATH_WS, {
          method: request.method,
          headers: request.headers,
        }),
      );
    }

    return handleDispatchWebSocketMemory(request, hub, env, repository);
  });
}

async function handleDispatchWebSocketMemory(
  request: IRequestStrict,
  hub: RealtimeHub,
  env: ApiEnv,
  repository: IRequirementRepository,
): Promise<Response> {
  const hashes = repository.listActiveApiTokenHashes("dispatcher");
  console.log(`[dispatch] ws: active dispatcher token hashes count=${hashes.length}`);

  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }
  if (typeof WebSocketPair === "undefined") {
    return new Response("WebSocket runtime unavailable", { status: 501 });
  }

  /* v8 ignore start */
  const pair = new WebSocketPair();
  const serverWs = pair[1] as WebSocket;
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
      const raw = event.data as string;
      const data = JSON.parse(raw);
      console.log(`[dispatch] ws: received type=${data.type}`);
      if (data.type === "dispatcher.pong") {
        console.log("[dispatch] ws: heartbeat pong from daemon");
        return;
      }
      if (data.type === "dispatch.acked") {
        const ack = dispatchAckedMessageSchema.parse(data);
        void broadcastRealtimeEvent(env, hub, {
          type: "dispatch.acked",
          eventId: `evt_${Date.now().toString(36)}`,
          requirementId: "unknown",
          success: ack.success,
          message: ack.success ? "Dispatch acknowledged" : (ack.errorMessage ?? "Dispatch failed"),
        });
      }
    } catch { /* invalid message */ }
  });

  serverWs.addEventListener("close", () => {
    console.log("[dispatch] ws: daemon disconnected");
    unregister();
  });
  serverWs.addEventListener("error", () => {
    console.log("[dispatch] ws: error");
    unregister();
  });

  serverWs.send(JSON.stringify({ type: "dispatcher.ping", timestamp: new Date().toISOString() }));
  console.log("[dispatch] ws: daemon connected");

  return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
  /* v8 ignore stop */
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
