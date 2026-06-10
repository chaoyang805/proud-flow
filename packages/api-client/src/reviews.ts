import {
  reviewActionResponseSchema,
  rollbackReviewRequestSchema,
  type ReviewActionResponse,
  type RollbackReviewRequest,
} from "@proud-flow/api-contract";
import type { ProudFlowHttpClient } from "./client";

export class ReviewsApiClient {
  constructor(private readonly http: ProudFlowHttpClient) {}

  rollback(
    requirementId: string,
    body: RollbackReviewRequest,
  ): Promise<ReviewActionResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/requirements/${requirementId}/reviews/rollback`,
      requestSchema: rollbackReviewRequestSchema,
      responseSchema: reviewActionResponseSchema,
      body,
    });
  }
}
