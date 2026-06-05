// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { skillPackage, supportsDispatchStages } from "../../src/index";

describe("case-rundown skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-case-rundown");
    assert.equal(supportsDispatchStages(), true);
  });

  it("documents the Proud Flow helper workflow without embedded credentials", () => {
    const content = readFileSync("SKILL.md", "utf8");
    assert.match(content, /proud-flow get-task-context <requirementId> --stage case_rundown/);
    assert.match(content, /proud-flow start-stage <requirementId> --stage case_rundown/);
    assert.match(content, /proud-flow attach-artifact <requirementId> --type case_pr/);
    assert.match(content, /proud-flow complete-stage <requirementId> --stage case_rundown/);
    assert.doesNotMatch(content, /pf_(skill|dispatcher|local)_/);
    assert.doesNotMatch(content, /fetch\(|curl\s|Authorization:/);
  });
});
