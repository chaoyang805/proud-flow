import {
  rollbackReviewRequestSchema,
  type RollbackReviewRequest,
} from "@proud-flow/api-contract";
import type { Requirement } from "@proud-flow/domain";
import { ApiError } from "../../middleware/error";
import type { InMemoryRequirementRepository } from "../requirements/repository";
import {
  approveReview,
  rollbackRequirement,
} from "../workflow/state-machine";

export class ReviewsService {
  constructor(private readonly repository: InMemoryRequirementRepository) {}

  approve(requirementId: string): Requirement {
    const requirement = this.getRequirement(requirementId);
    const status = approveReview(requirement);
    const updated = this.repository.updateRequirement(requirementId, {
      status,
    });
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return updated;
  }

  rollback(requirementId: string, input: unknown): Requirement {
    const request: RollbackReviewRequest =
      rollbackReviewRequestSchema.parse(input);
    const requirement = this.getRequirement(requirementId);
    const nextVersion = rollbackRequirement(
      requirement,
      request.targetStatus,
      request.reason,
    );
    const updated = this.repository.updateRequirement(requirementId, {
      status: request.targetStatus,
      version: nextVersion,
    });
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return updated;
  }

  private getRequirement(requirementId: string): Requirement {
    const requirement = this.repository.getRequirement(requirementId);
    if (!requirement)
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return requirement;
  }
}
