import {
  createArtifactRequestSchema,
  uploadArtifactRequestSchema,
  type CreateArtifactRequest,
  type UploadArtifactRequest,
} from "@proud-flow/api-contract";
import type { Artifact } from "@proud-flow/domain";
import { ApiError } from "../../middleware/error.js";
import type { InMemoryRequirementRepository } from "../requirements/repository.js";
import type { ArtifactStorage } from "./storage.js";
import { archiveRequirement } from "../workflow/state-machine.js";

export class ArtifactsService {
  constructor(
    private readonly repository: InMemoryRequirementRepository,
    private readonly storage: ArtifactStorage,
  ) {}

  list(requirementId: string): Artifact[] {
    this.requireRequirement(requirementId);
    return this.repository.listArtifacts(requirementId);
  }

  create(requirementId: string, input: unknown): Artifact {
    const request: CreateArtifactRequest =
      createArtifactRequestSchema.parse(input);
    const requirement = this.requireRequirement(requirementId);
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
    const requirement = this.requireRequirement(requirementId);
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

  archive(requirementId: string): Artifact[] {
    const requirement = this.requireRequirement(requirementId);
    const artifacts = this.repository.listArtifacts(requirementId);
    const status = archiveRequirement(requirement, artifacts);
    this.repository.updateRequirement(requirementId, { status });
    return artifacts;
  }

  private requireRequirement(requirementId: string) {
    const requirement = this.repository.getRequirement(requirementId);
    if (!requirement)
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return requirement;
  }
}
