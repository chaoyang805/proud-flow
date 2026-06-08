import {
  createRequirementRequestSchema,
  updateRequirementRequestSchema,
  type CreateRequirementRequest,
  type UpdateRequirementRequest,
} from "@proud-flow/api-contract";
import type { Requirement } from "@proud-flow/domain";
import { ApiError } from "../../middleware/error";
import type { IRequirementRepository } from "./repository";

export class RequirementsService {
  constructor(private readonly repository: IRequirementRepository) {}

  async create(input: unknown): Promise<Requirement> {
    const request: CreateRequirementRequest =
      createRequirementRequestSchema.parse(input);
    return this.repository.createRequirement(request);
  }

  async list(): Promise<Requirement[]> {
    return this.repository.listRequirements();
  }

  async get(id: string): Promise<Requirement> {
    const requirement = await this.repository.getRequirement(id);
    if (!requirement)
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return requirement;
  }

  async update(id: string, input: unknown): Promise<Requirement> {
    const request: UpdateRequirementRequest =
      updateRequirementRequestSchema.parse(input);
    const existing = await this.get(id);
    if (existing.status !== "planning") {
      throw new ApiError(
        409,
        "INVALID_STATUS_TRANSITION",
        "Only planning requirements can be edited",
      );
    }
    const updated = await this.repository.updateRequirement(id, request);
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return updated;
  }
}
