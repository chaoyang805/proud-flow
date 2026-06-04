import type { ArtifactType } from "./artifact.js";
import { dispatchStageToActiveStatus, type DispatchStage } from "./dispatch.js";
import type { RequirementStatus } from "./requirement.js";

export const workflowStatuses: RequirementStatus[] = [
  "planning",
  "tech-design",
  "tech-review",
  "case-rundown",
  "case-review",
  "developing",
  "delivery",
  "archived",
];

export const dispatchStageToReviewStatus = {
  tech_design: "tech-review",
  case_rundown: "case-review",
  development: "delivery",
} as const satisfies Record<DispatchStage, RequirementStatus>;

export const dispatchStageRequiredArtifacts = {
  tech_design: ["tech_design_pr"],
  case_rundown: ["case_rundown_pr", "case_rundown_doc"],
  development: ["development_pr", "test_report"],
} as const satisfies Record<DispatchStage, readonly ArtifactType[]>;

export function getActiveStatusForDispatchStage(
  stage: DispatchStage,
): RequirementStatus {
  return dispatchStageToActiveStatus[stage];
}

export function getReviewStatusForDispatchStage(
  stage: DispatchStage,
): RequirementStatus {
  return dispatchStageToReviewStatus[stage];
}

export function getRequiredArtifactsForDispatchStage(
  stage: DispatchStage,
): readonly ArtifactType[] {
  return dispatchStageRequiredArtifacts[stage];
}

export function canRollbackFromStatus(status: RequirementStatus): boolean {
  return (
    status === "tech-review" ||
    status === "case-review" ||
    status === "delivery"
  );
}

export function isStatusBefore(
  candidate: RequirementStatus,
  current: RequirementStatus,
): boolean {
  return (
    workflowStatuses.indexOf(candidate) < workflowStatuses.indexOf(current)
  );
}
