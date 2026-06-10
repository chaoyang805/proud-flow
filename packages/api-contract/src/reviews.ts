import {
  requirementStatuses,
  type RequirementStatus,
} from "@proud-flow/domain";
import {
  enumSchema,
  objectSchema,
  stringSchema,
  type Schema,
} from "./schema";
import {
  requirementResponseSchema,
  type RequirementResponse,
} from "./requirements";

export interface RollbackReviewRequest {
  targetStatus: RequirementStatus;
  reason: string;
}

export interface ReviewActionResponse {
  requirement: RequirementResponse;
}

export const rollbackReviewRequestSchema: Schema<RollbackReviewRequest> =
  objectSchema({
    targetStatus: enumSchema(requirementStatuses) as Schema<RequirementStatus>,
    reason: stringSchema({ minLength: 1 }),
  });

export const reviewActionResponseSchema: Schema<ReviewActionResponse> =
  objectSchema({
    requirement: requirementResponseSchema,
  });
