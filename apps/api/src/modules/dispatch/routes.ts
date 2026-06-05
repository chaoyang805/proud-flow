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
  const dispatchMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/dispatch$/,
  );
  if (dispatchMatch && request.method === "POST") {
    const body = dispatchRequirementRequestSchema.parse(await request.json());
    const requirement = repository.getRequirement(dispatchMatch[1]);
    if (!requirement) {
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    }
    ensureDispatchAllowed(requirement.status, body.stage);
    const dispatchRequest = repository.createDispatchRequest({
      requirementId: requirement.id,
      stage: body.stage,
    });
    return jsonResponse({
      requestId: dispatchRequest.requestId,
      stage: dispatchRequest.stage,
      accepted: true,
    });
  }

  if (pathname === "/api/dispatch/next" && request.method === "GET") {
    await requireDispatcherToken(request, env, repository);
    const pending = repository.getNextPendingDispatchRequest();
    if (!pending) {
      return jsonResponse({ empty: true });
    }
    return jsonResponse({
      type: pending.type,
      requestId: pending.requestId,
      requirementId: pending.requirementId,
      stage: pending.stage,
    });
  }

  if (pathname === "/api/dispatch/ack" && request.method === "POST") {
    await requireDispatcherToken(request, env, repository);
    const ack = dispatchAckedMessageSchema.parse(await request.json());
    const updated = repository.ackDispatchRequest(ack);
    if (!updated) {
      throw new ApiError(404, "NOT_FOUND", "Dispatch request not found");
    }
    return jsonResponse({ acknowledged: true });
  }

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
