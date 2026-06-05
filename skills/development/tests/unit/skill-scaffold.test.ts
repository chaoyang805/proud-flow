// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { skillPackage, supportsDispatchStages } from "../../src/index";

describe("development skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-development");
    assert.equal(supportsDispatchStages(), true);
  });

  it("documents the Proud Flow helper workflow without embedded credentials", () => {
    const content = readFileSync("SKILL.md", "utf8");
    assert.match(content, /proud-flow get-task-context <requirementId> --stage development/);
    assert.match(content, /proud-flow start-stage <requirementId> --stage development/);
    assert.match(content, /proud-flow attach-artifact <requirementId> --type code_pr/);
    assert.match(content, /proud-flow complete-stage <requirementId> --stage development/);
    assert.doesNotMatch(content, /pf_(skill|dispatcher|local)_/);
    assert.doesNotMatch(content, /fetch\(|curl\s|Authorization:/);
  });
});
