// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { skillPackage, supportsDispatchStages } from "../../src/index";

describe("tech-design skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-tech-design");
    assert.equal(supportsDispatchStages(), true);
  });
});
