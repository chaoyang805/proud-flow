import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { skillPackage, supportsDispatchStages } from "../../dist/index.js";

describe("development skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-development");
    assert.equal(supportsDispatchStages(), true);
  });
});
