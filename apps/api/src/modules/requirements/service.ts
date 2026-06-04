import {
  createRequirementRequestSchema,
  updateRequirementRequestSchema,
  type CreateRequirementRequest,
  type UpdateRequirementRequest,
} from "@proud-flow/api-contract";
import type { Requirement } from "@proud-flow/domain";
import { ApiError } from "../../middleware/error.js";
import type { InMemoryRequirementRepository } from "./repository.js";

export class RequirementsService {
  constructor(private readonly repository: InMemoryRequirementRepository) {}

  create(input: unknown): Requirement {
    const request: CreateRequirementRequest =
      createRequirementRequestSchema.parse(input);
    return this.repository.createRequirement(request);
  }

  list(): Requirement[] {
    return this.repository.listRequirements();
  }

  get(id: string): Requirement {
    const requirement = this.repository.getRequirement(id);
    if (!requirement)
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return requirement;
  }

  update(id: string, input: unknown): Requirement {
    const request: UpdateRequirementRequest =
      updateRequirementRequestSchema.parse(input);
    const existing = this.get(id);
    if (existing.status !== "planning") {
      throw new ApiError(
        409,
        "INVALID_STATUS_TRANSITION",
        "Only planning requirements can be edited",
      );
    }
    const updated = this.repository.updateRequirement(id, request);
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return updated;
  }
}
