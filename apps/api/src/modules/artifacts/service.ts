import {
  createArtifactRequestSchema,
  uploadArtifactRequestSchema,
  type CreateArtifactRequest,
  type UploadArtifactRequest,
} from "@proud-flow/api-contract";
import type { Artifact } from "@proud-flow/domain";
import { ApiError } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import type { ArtifactStorage } from "./storage";
import { archiveRequirement } from "../workflow/state-machine";

export class ArtifactsService {
  constructor(
    private readonly repository: IRequirementRepository,
    private readonly storage: ArtifactStorage,
  ) {}

  async list(requirementId: string): Promise<Artifact[]> {
    await this.requireRequirement(requirementId);
    return this.repository.listArtifacts(requirementId);
  }

  async create(requirementId: string, input: unknown): Promise<Artifact> {
    const request: CreateArtifactRequest =
      createArtifactRequestSchema.parse(input);
    const requirement = await this.requireRequirement(requirementId);
    return this.repository.createArtifact({
      requirementId,
      requirementVersion: requirement.version,
      type: request.type,
      title: request.title,
      url: request.url,
      content: request.content,
    });
  }

  async upload(requirementId: string, input: unknown): Promise<Artifact> {
    const request: UploadArtifactRequest =
      uploadArtifactRequestSchema.parse(input);
    const requirement = await this.requireRequirement(requirementId);
    const url = await this.storage.upload(
      requirementId,
      request.fileName,
      request.contentBase64,
      request.contentType,
    );
    return this.repository.createArtifact({
      requirementId,
      requirementVersion: requirement.version,
      type: request.type,
      title: request.title,
      url,
    });
  }

  async archive(requirementId: string): Promise<Artifact[]> {
    const requirement = await this.requireRequirement(requirementId);
    const artifacts = await this.repository.listArtifacts(requirementId);
    const status = archiveRequirement(requirement, artifacts);
    await this.repository.updateRequirement(requirementId, { status });
    return artifacts;
  }

  private async requireRequirement(requirementId: string) {
    const requirement = await this.repository.getRequirement(requirementId);
    if (!requirement)
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return requirement;
  }
}
