// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { skillPackage, supportsDispatchStages } from "../../src/index";

describe("development skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-development");
    assert.equal(supportsDispatchStages(), true);
  });
});
