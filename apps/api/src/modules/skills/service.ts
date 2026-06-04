import {
  addNoteRequestSchema,
  completeStageRequestSchema,
  failStageRequestSchema,
  startStageRequestSchema,
  type TaskContextResponse,
} from "@proud-flow/api-contract";
import {
  getActiveStatusForDispatchStage,
  getRequiredArtifactsForDispatchStage,
  type RequirementStatus,
} from "@proud-flow/domain";
import { ApiError } from "../../middleware/error.js";
import type { ArtifactsService } from "../artifacts/service.js";
import type { InMemoryRequirementRepository } from "../requirements/repository.js";
import { completeAiStage, startAiStage } from "../workflow/state-machine.js";

export class SkillsApiService {
  constructor(
    private readonly repository: InMemoryRequirementRepository,
    private readonly artifacts: ArtifactsService,
  ) {}

  getRequirement(requirementId: string) {
    return this.requireRequirement(requirementId);
  }

  getTaskContext(requirementId: string): TaskContextResponse {
    const requirement = this.requireRequirement(requirementId);
    const artifacts = this.repository.listArtifacts(requirementId);
    return {
      requirement,
      currentArtifacts: {
        items: artifacts.filter(
          (artifact) => artifact.requirementVersion === requirement.version,
        ),
      },
      historicalArtifacts: {
        items: artifacts.filter(
          (artifact) => artifact.requirementVersion < requirement.version,
        ),
      },
      requiredArtifactTypes: [...getRequiredArtifactsForStatus(requirement.status)],
      allowedActions: getAllowedActionsForStatus(requirement.status),
    };
  }

  startStage(requirementId: string, input: unknown) {
    const request = startStageRequestSchema.parse(input);
    const requirement = this.requireRequirement(requirementId);
    const status = startAiStage(requirement, request.stage);
    return { requirement: this.repository.updateRequirement(requirementId, { status }) };
  }

  attachArtifact(requirementId: string, input: unknown) {
    return this.artifacts.create(requirementId, input);
  }

  uploadArtifact(requirementId: string, input: unknown) {
    return this.artifacts.upload(requirementId, input);
  }

  completeStage(requirementId: string, input: unknown) {
    const request = completeStageRequestSchema.parse(input);
    const requirement = this.requireRequirement(requirementId);
    const status = completeAiStage(
      requirement,
      request.stage,
      this.repository.listArtifacts(requirementId),
    );
    return { requirement: this.repository.updateRequirement(requirementId, { status }) };
  }

  failStage(requirementId: string, input: unknown) {
    const request = failStageRequestSchema.parse(input);
    return {
      requirement: this.requireRequirement(requirementId),
      stage: request.stage,
      message: request.message,
    };
  }

  addNote(requirementId: string, input: unknown) {
    const request = addNoteRequestSchema.parse(input);
    return this.artifacts.create(requirementId, {
      type: "note",
      title: "Skill note",
      content: request.message,
    });
  }

  private requireRequirement(requirementId: string) {
    const requirement = this.repository.getRequirement(requirementId);
    if (!requirement)
      throw new ApiError(404, "NOT_FOUND", "Requirement not found");
    return requirement;
  }
}

function getRequiredArtifactsForStatus(status: RequirementStatus) {
  if (status === "tech-design") {
    return getRequiredArtifactsForDispatchStage("tech_design");
  }
  if (status === "case-rundown") {
    return getRequiredArtifactsForDispatchStage("case_rundown");
  }
  if (status === "developing") {
    return getRequiredArtifactsForDispatchStage("development");
  }
  return [];
}

function getAllowedActionsForStatus(status: RequirementStatus): string[] {
  const activeStatuses = [
    getActiveStatusForDispatchStage("tech_design"),
    getActiveStatusForDispatchStage("case_rundown"),
    getActiveStatusForDispatchStage("development"),
  ];
  if (activeStatuses.includes(status)) {
    return ["attach-artifact", "upload-artifact", "complete-stage", "fail-stage", "notes"];
  }
  return ["get-requirement", "get-task-context"];
}
