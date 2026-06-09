// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  isRootQualityTask,
  rootQualityTasks,
  workspacePackageGlobs,
} from "../../src/index";

describe("workspace engineering config", () => {
  it("lists every P0 workspace glob", () => {
    assert.deepEqual(workspacePackageGlobs, ["apps/*", "packages/*"]);
  });

  it("recognizes root quality tasks", () => {
    assert.ok(rootQualityTasks.includes("typecheck"));
    assert.ok(rootQualityTasks.includes("lint"));
    assert.ok(rootQualityTasks.includes("test"));
    assert.ok(rootQualityTasks.includes("build"));
    assert.equal(isRootQualityTask("build"), true);
    assert.equal(isRootQualityTask("unknown"), false);
  });
});
