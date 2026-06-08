import {
  rollbackReviewRequestSchema,
  type RollbackReviewRequest,
} from "@proud-flow/api-contract";
import type { Requirement } from "@proud-flow/domain";
import { ApiError } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import {
  approveReview,
  rollbackRequirement,
} from "../workflow/state-machine";

export class ReviewsService {
  constructor(private readonly repository: IRequirementRepository) {}

  async approve(requirementId: string): Promise<Requirement> {
    const requirement = await this.getRequirement(requirementId);
    const status = approveReview(requirement);
    const updated = await this.repository.updateRequirement(requirementId, {
      status,
    });
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return updated;
  }

  async rollback(requirementId: string, input: unknown): Promise<Requirement> {
    const request: RollbackReviewRequest =
      rollbackReviewRequestSchema.parse(input);
    const requirement = await this.getRequirement(requirementId);
    const nextVersion = rollbackRequirement(
      requirement,
      request.targetStatus,
      request.reason,
    );
    const updated = await this.repository.updateRequirement(requirementId, {
      status: request.targetStatus,
      version: nextVersion,
    });
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return updated;
  }

  private async getRequirement(requirementId: string): Promise<Requirement> {
    const requirement = await this.repository.getRequirement(requirementId);
    if (!requirement)
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return requirement;
  }
}
