import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { skillPackage, supportsDispatchStages } from "../../dist/index.js";

describe("tech-design skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-tech-design");
    assert.equal(supportsDispatchStages(), true);
  });
});
