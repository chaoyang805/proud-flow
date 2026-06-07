// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  artifactTypes,
  isArtifactType,
  dispatchStages,
  isDispatchStage,
  errorCodes,
  isErrorCode,
  idPatterns,
  isIdOfKind,
  parseId,
  requirementStatuses,
  priorities,
  isRequirementStatus,
  isPriority,
  actorTypes,
  tokenTypes,
  isActorType,
  isTokenType,
  workflowStatuses,
  dispatchStageToActiveStatus,
  dispatchStageToReviewStatus,
  dispatchStageRequiredArtifacts,
  getActiveStatusForDispatchStage,
  getReviewStatusForDispatchStage,
  getRequiredArtifactsForDispatchStage,
  canRollbackFromStatus,
  isStatusBefore,
} from "../../src/index";

describe("artifact module", () => {
  it("validates all artifact types", () => {
    for (const t of artifactTypes) {
      assert.equal(isArtifactType(t), true);
    }
  });

  it("isArtifactType returns false for unknown", () => {
    assert.equal(isArtifactType("unknown_type"), false);
    assert.equal(isArtifactType(""), false);
  });

  it("artifactTypes contains expected values", () => {
    assert.ok(artifactTypes.includes("tech_design_pr"));
    assert.ok(artifactTypes.includes("test_report"));
    assert.ok(artifactTypes.includes("note"));
  });
});

describe("dispatch module", () => {
  it("validates all dispatch stages", () => {
    for (const s of dispatchStages) {
      assert.equal(isDispatchStage(s), true);
    }
  });

  it("isDispatchStage returns false for unknown", () => {
    assert.equal(isDispatchStage("unknown"), false);
    assert.equal(isDispatchStage(""), false);
  });

  it("dispatchStageToActiveStatus maps all stages", () => {
    assert.equal(dispatchStageToActiveStatus.tech_design, "tech-design");
    assert.equal(dispatchStageToActiveStatus.case_rundown, "case-rundown");
    assert.equal(dispatchStageToActiveStatus.development, "developing");
  });
});

describe("errors module", () => {
  it("validates all error codes", () => {
    for (const c of errorCodes) {
      assert.equal(isErrorCode(c), true);
    }
  });

  it("isErrorCode returns false for unknown", () => {
    assert.equal(isErrorCode("RANDOM_ERROR"), false);
    assert.equal(isErrorCode(""), false);
  });

  it("errorCodes contains key codes", () => {
    assert.ok(errorCodes.includes("UNAUTHORIZED"));
    assert.ok(errorCodes.includes("INVALID_STATUS_TRANSITION"));
    assert.ok(errorCodes.includes("INTERNAL_ERROR"));
  });
});

describe("ids module", () => {
  it("validates requirement ids", () => {
    assert.equal(isIdOfKind("requirement", "REQ-000123"), true);
    assert.equal(isIdOfKind("requirement", "REQ-123"), false);
    assert.equal(isIdOfKind("requirement", ""), false);
  });

  it("validates event ids", () => {
    assert.equal(isIdOfKind("event", "evt_abc123"), true);
    assert.equal(isIdOfKind("event", "bad"), false);
  });

  it("validates artifact ids", () => {
    assert.equal(isIdOfKind("artifact", "art_test"), true);
    assert.equal(isIdOfKind("artifact", "bad"), false);
  });

  it("validates dispatch request ids", () => {
    assert.equal(isIdOfKind("dispatchRequest", "dispatch_req_1"), true);
    assert.equal(isIdOfKind("dispatchRequest", "bad"), false);
  });

  it("validates token ids", () => {
    assert.equal(isIdOfKind("token", "pf_skill_token"), true);
    assert.equal(isIdOfKind("token", "pf_dispatcher_abc"), true);
    assert.equal(isIdOfKind("token", "pf_user_123"), true);
    assert.equal(isIdOfKind("token", "pf_bootstrap_xyz"), true);
    assert.equal(isIdOfKind("token", "pf_local_key"), true);
    assert.equal(isIdOfKind("token", "bad"), false);
  });

  it("parseId returns parsed id for valid input", () => {
    assert.deepEqual(parseId("requirement", "REQ-000123"), {
      kind: "requirement",
      value: "REQ-000123",
    });
    assert.deepEqual(parseId("dispatchRequest", "dispatch_req_abc"), {
      kind: "dispatchRequest",
      value: "dispatch_req_abc",
    });
  });

  it("parseId throws for invalid input", () => {
    assert.throws(() => parseId("requirement", "REQ-1"));
    assert.throws(() => parseId("dispatchRequest", "bad"));
    assert.throws(() => parseId("token", "invalid"));
  });

  it("idPatterns has all expected keys", () => {
    assert.ok("requirement" in idPatterns);
    assert.ok("event" in idPatterns);
    assert.ok("artifact" in idPatterns);
    assert.ok("dispatchRequest" in idPatterns);
    assert.ok("token" in idPatterns);
  });
});

describe("requirement module", () => {
  it("validates all requirement statuses", () => {
    for (const s of requirementStatuses) {
      assert.equal(isRequirementStatus(s), true);
    }
  });

  it("isRequirementStatus returns false for unknown", () => {
    assert.equal(isRequirementStatus("random"), false);
    assert.equal(isRequirementStatus(""), false);
  });

  it("validates all priorities", () => {
    for (const p of priorities) {
      assert.equal(isPriority(p), true);
    }
  });

  it("isPriority returns false for unknown", () => {
    assert.equal(isPriority("extreme"), false);
    assert.equal(isPriority(""), false);
  });
});

describe("tokens module", () => {
  it("validates all actor types", () => {
    for (const a of actorTypes) {
      assert.equal(isActorType(a), true);
    }
  });

  it("isActorType returns false for unknown", () => {
    assert.equal(isActorType("robot"), false);
    assert.equal(isActorType(""), false);
  });

  it("validates all token types", () => {
    for (const t of tokenTypes) {
      assert.equal(isTokenType(t), true);
    }
  });

  it("isTokenType returns false for unknown", () => {
    assert.equal(isTokenType("admin"), false);
    assert.equal(isTokenType(""), false);
  });
});

describe("workflow module", () => {
  it("workflowStatuses matches requirementStatuses", () => {
    assert.deepEqual(workflowStatuses, requirementStatuses);
  });

  it("getActiveStatusForDispatchStage maps correctly", () => {
    assert.equal(getActiveStatusForDispatchStage("tech_design"), "tech-design");
    assert.equal(getActiveStatusForDispatchStage("case_rundown"), "case-rundown");
    assert.equal(getActiveStatusForDispatchStage("development"), "developing");
  });

  it("getReviewStatusForDispatchStage maps correctly", () => {
    assert.equal(getReviewStatusForDispatchStage("tech_design"), "tech-review");
    assert.equal(getReviewStatusForDispatchStage("case_rundown"), "case-review");
    assert.equal(getReviewStatusForDispatchStage("development"), "delivery");
  });

  it("getRequiredArtifactsForDispatchStage returns artifacts", () => {
    assert.deepEqual(getRequiredArtifactsForDispatchStage("tech_design"), ["tech_design_pr"]);
    assert.deepEqual(getRequiredArtifactsForDispatchStage("case_rundown"), ["case_rundown_pr", "case_rundown_doc"]);
    assert.deepEqual(getRequiredArtifactsForDispatchStage("development"), ["development_pr", "test_report"]);
  });

  it("canRollbackFromStatus identifies rollback states", () => {
    assert.equal(canRollbackFromStatus("tech-review"), true);
    assert.equal(canRollbackFromStatus("case-review"), true);
    assert.equal(canRollbackFromStatus("delivery"), true);
    assert.equal(canRollbackFromStatus("planning"), false);
    assert.equal(canRollbackFromStatus("tech-design"), false);
    assert.equal(canRollbackFromStatus("archived"), false);
  });

  it("isStatusBefore compares order correctly", () => {
    assert.equal(isStatusBefore("planning", "delivery"), true);
    assert.equal(isStatusBefore("tech-design", "tech-review"), true);
    assert.equal(isStatusBefore("delivery", "planning"), false);
    assert.equal(isStatusBefore("archived", "planning"), false);
    assert.equal(isStatusBefore("planning", "planning"), false);
  });

  it("dispatchStageToReviewStatus covers all stages", () => {
    assert.ok("tech_design" in dispatchStageToReviewStatus);
    assert.ok("case_rundown" in dispatchStageToReviewStatus);
    assert.ok("development" in dispatchStageToReviewStatus);
  });

  it("dispatchStageRequiredArtifacts covers all stages", () => {
    assert.ok("tech_design" in dispatchStageRequiredArtifacts);
    assert.ok("case_rundown" in dispatchStageRequiredArtifacts);
    assert.ok("development" in dispatchStageRequiredArtifacts);
  });
});
