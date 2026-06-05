import {
  canRollbackFromStatus,
  getActiveStatusForDispatchStage,
  getRequiredArtifactsForDispatchStage,
  getReviewStatusForDispatchStage,
  isStatusBefore,
  type Artifact,
  type DispatchStage,
  type Requirement,
  type RequirementStatus,
} from "@proud-flow/domain";
import { ApiError } from "../../middleware/error";

export function startAiStage(
  requirement: Requirement,
  stage: DispatchStage,
): RequirementStatus {
  const target = getActiveStatusForDispatchStage(stage);
  const allowedSource = getDispatchSourceStatus(stage);
  if (requirement.status !== allowedSource) {
    throw new ApiError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot start ${stage} from ${requirement.status}`,
    );
  }
  return target;
}

export function completeAiStage(
  requirement: Requirement,
  stage: DispatchStage,
  artifacts: readonly Artifact[],
): RequirementStatus {
  const activeStatus = getActiveStatusForDispatchStage(stage);
  if (requirement.status !== activeStatus) {
    throw new ApiError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot complete ${stage} from ${requirement.status}`,
    );
  }
  ensureRequiredArtifacts(stage, requirement.version, artifacts);
  return getReviewStatusForDispatchStage(stage);
}

export function approveReview(requirement: Requirement): RequirementStatus {
  if (requirement.status === "tech-review") return "case-rundown";
  if (requirement.status === "case-review") return "developing";
  throw new ApiError(
    409,
    "INVALID_STATUS_TRANSITION",
    `Cannot approve review from ${requirement.status}`,
  );
}

export function rollbackRequirement(
  requirement: Requirement,
  targetStatus: RequirementStatus,
  reason: string,
): number {
  if (!canRollbackFromStatus(requirement.status)) {
    throw new ApiError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot rollback from ${requirement.status}`,
    );
  }
  if (!reason.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", "Rollback reason is required");
  }
  if (!isStatusBefore(targetStatus, requirement.status)) {
    throw new ApiError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Rollback target ${targetStatus} must be before ${requirement.status}`,
    );
  }
  return requirement.version + 1;
}

export function archiveRequirement(
  requirement: Requirement,
  artifacts: readonly Artifact[],
): RequirementStatus {
  if (requirement.status !== "delivery") {
    throw new ApiError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot archive from ${requirement.status}`,
    );
  }
  const hasAcceptance = artifacts.some(
    (artifact) =>
      artifact.requirementVersion === requirement.version &&
      artifact.type === "acceptance_record",
  );
  if (!hasAcceptance) {
    throw new ApiError(
      409,
      "MISSING_REQUIRED_ARTIFACT",
      "Acceptance record is required before archive",
    );
  }
  return "archived";
}

export function ensureRequiredArtifacts(
  stage: DispatchStage,
  version: number,
  artifacts: readonly Artifact[],
): void {
  const required = getRequiredArtifactsForDispatchStage(stage);
  const currentArtifactTypes = new Set(
    artifacts
      .filter((artifact) => artifact.requirementVersion === version)
      .map((artifact) => artifact.type),
  );
  const hasRequired = required.some((artifactType) =>
    currentArtifactTypes.has(artifactType),
  );
  if (!hasRequired) {
    throw new ApiError(
      409,
      "MISSING_REQUIRED_ARTIFACT",
      `Missing required artifact for ${stage}`,
    );
  }
}

function getDispatchSourceStatus(stage: DispatchStage): RequirementStatus {
  if (stage === "tech_design") return "planning";
  if (stage === "case_rundown") return "case-rundown";
  return "developing";
}
