import {
  dispatchRequirementRequestSchema,
  dispatchRequirementResponseSchema,
  type DispatchRequirementRequest,
  type DispatchRequirementResponse,
} from "@proud-flow/api-contract";
import type { DispatchAckedMessage, DispatchMessage } from "@proud-flow/domain";
import type { ProudFlowHttpClient } from "./client";

export type DispatchNextResponse =
  | { empty: true }
  | Extract<DispatchMessage, { type: "dispatch.requested" }>;

export interface DispatchAckResponse {
  acknowledged: boolean;
}

export class DispatchApiClient {
  constructor(private readonly http: ProudFlowHttpClient) {}

  dispatch(
    requirementId: string,
    body: DispatchRequirementRequest,
  ): Promise<DispatchRequirementResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/requirements/${requirementId}/dispatch`,
      requestSchema: dispatchRequirementRequestSchema,
      responseSchema: dispatchRequirementResponseSchema,
      body,
    });
  }

  next(): Promise<DispatchNextResponse> {
    return this.http.request({
      method: "GET",
      path: "/api/dispatch/next",
    });
  }

  ack(body: DispatchAckedMessage): Promise<DispatchAckResponse> {
    return this.http.request({
      method: "POST",
      path: "/api/dispatch/ack",
      body,
    });
  }
}
