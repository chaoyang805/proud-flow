import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRollbackFromStatus,
  dispatchStageToActiveStatus,
  dispatchStageToReviewStatus,
  getActiveStatusForDispatchStage,
  getRequiredArtifactsForDispatchStage,
  getReviewStatusForDispatchStage,
  isArtifactType,
  isDispatchStage,
  isErrorCode,
  isIdOfKind,
  isPriority,
  isRequirementStatus,
  isStatusBefore,
  isActorType,
  isTokenType,
  parseId,
  requirementStatuses,
} from "../../dist/index.js";

describe("domain package", () => {
  it("defines requirement statuses and priority guards", () => {
    assert.deepEqual(requirementStatuses, [
      "planning",
      "tech-design",
      "tech-review",
      "case-rundown",
      "case-review",
      "developing",
      "delivery",
      "archived",
    ]);
    assert.equal(isRequirementStatus("tech-review"), true);
    assert.equal(isRequirementStatus("unknown"), false);
    assert.equal(isPriority("urgent"), true);
    assert.equal(isActorType("skill"), true);
    assert.equal(isTokenType("dispatcher"), true);
  });

  it("maps dispatch stages to active and review statuses", () => {
    assert.deepEqual(dispatchStageToActiveStatus, {
      tech_design: "tech-design",
      case_rundown: "case-rundown",
      development: "developing",
    });
    assert.deepEqual(dispatchStageToReviewStatus, {
      tech_design: "tech-review",
      case_rundown: "case-review",
      development: "delivery",
    });
    assert.equal(getActiveStatusForDispatchStage("tech_design"), "tech-design");
    assert.equal(getReviewStatusForDispatchStage("development"), "delivery");
    assert.deepEqual(getRequiredArtifactsForDispatchStage("development"), [
      "development_pr",
      "test_report",
    ]);
  });

  it("validates domain enums and ids", () => {
    assert.equal(isDispatchStage("case_rundown"), true);
    assert.equal(isArtifactType("test_report"), true);
    assert.equal(isErrorCode("INVALID_STATUS_TRANSITION"), true);
    assert.equal(isIdOfKind("requirement", "REQ-000123"), true);
    assert.deepEqual(parseId("dispatchRequest", "dispatch_req_abc"), {
      kind: "dispatchRequest",
      value: "dispatch_req_abc",
    });
    assert.throws(() => parseId("requirement", "REQ-1"));
  });

  it("encodes rollback review states", () => {
    assert.equal(canRollbackFromStatus("tech-review"), true);
    assert.equal(canRollbackFromStatus("planning"), false);
    assert.equal(isStatusBefore("planning", "delivery"), true);
  });
});
