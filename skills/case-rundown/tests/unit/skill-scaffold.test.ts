// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { skillPackage, supportsDispatchStages } from "../../src/index";

describe("case-rundown skill scaffold", () => {
  it("resolves the shared domain stages", () => {
    assert.equal(skillPackage.name, "@proud-flow/skill-case-rundown");
    assert.equal(supportsDispatchStages(), true);
  });
});
