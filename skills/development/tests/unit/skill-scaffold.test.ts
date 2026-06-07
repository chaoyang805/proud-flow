// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { skillPackage, supportsDispatchStages } from "../../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillMdPath = join(__dirname, "..", "..", "SKILL.md");

describe("development skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-development");
    assert.equal(supportsDispatchStages(), true);
  });

  it("documents the Proud Flow helper workflow without embedded credentials", () => {
    const content = readFileSync(skillMdPath, "utf8");
    assert.match(content, /proud-flow get-task-context <requirementId>/);
    assert.match(content, /proud-flow start-stage <requirementId> --stage/);
    assert.match(content, /proud-flow attach-artifact <requirementId>/);
    assert.match(content, /proud-flow complete-stage <requirementId>/);
    assert.doesNotMatch(content, /pf_(skill|dispatcher|local)_/);
    assert.doesNotMatch(content, /fetch\(|curl\s|Authorization:/);
  });
});
