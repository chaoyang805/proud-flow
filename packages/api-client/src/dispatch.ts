import {
  dispatchRequirementRequestSchema,
  dispatchRequirementResponseSchema,
  type DispatchRequirementRequest,
  type DispatchRequirementResponse,
} from "@proud-flow/api-contract";
import type { ProudFlowHttpClient } from "./client";

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
}
