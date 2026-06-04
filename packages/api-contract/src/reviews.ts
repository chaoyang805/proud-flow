import {
  requirementStatuses,
  type RequirementStatus,
} from "@proud-flow/domain";
import {
  enumSchema,
  objectSchema,
  stringSchema,
  type Schema,
} from "./schema.js";
import {
  requirementResponseSchema,
  type RequirementResponse,
} from "./requirements.js";

export interface ApproveReviewRequest {
  note: string;
}

export interface RollbackReviewRequest {
  targetStatus: RequirementStatus;
  reason: string;
}

export interface ReviewActionResponse {
  requirement: RequirementResponse;
}

export const approveReviewRequestSchema: Schema<ApproveReviewRequest> =
  objectSchema({
    note: stringSchema({ minLength: 1 }),
  });

export const rollbackReviewRequestSchema: Schema<RollbackReviewRequest> =
  objectSchema({
    targetStatus: enumSchema(requirementStatuses) as Schema<RequirementStatus>,
    reason: stringSchema({ minLength: 1 }),
  });

export const reviewActionResponseSchema: Schema<ReviewActionResponse> =
  objectSchema({
    requirement: requirementResponseSchema,
  });
