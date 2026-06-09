// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  SchemaValidationError,
  completeStageRequestSchema,
  skillCreateArtifactRequestSchema,
} from "../../src/index";

describe("schema validation errors", () => {
  it("reports field name and allowed enum values for invalid stage", () => {
    try {
      completeStageRequestSchema.parse({ stage: "case-rundown" });
      assert.fail("expected validation error");
    } catch (error) {
      assert.ok(error instanceof SchemaValidationError);
      assert.equal(error.field, "stage");
      assert.equal(error.value, "case-rundown");
      assert.ok(error.allowedValues?.includes("case_rundown"));
      assert.match(error.formatMessage(), /field "stage"/);
      assert.match(error.formatMessage(), /case-rundown/);
      assert.match(error.formatMessage(), /case_rundown/);
    }
  });

  it("reports field name and allowed enum values for invalid artifact type", () => {
    try {
      skillCreateArtifactRequestSchema.parse({
        type: "case_pr",
        title: "Test",
        url: "https://example.com",
      });
      assert.fail("expected validation error");
    } catch (error) {
      assert.ok(error instanceof SchemaValidationError);
      assert.equal(error.field, "type");
      assert.equal(error.value, "case_pr");
      assert.ok(error.allowedValues?.includes("case_rundown_pr"));
      assert.match(error.formatMessage(), /field "type"/);
      assert.match(error.formatMessage(), /case_pr/);
      assert.match(error.formatMessage(), /case_rundown_pr/);
    }
  });

  it("reports missing required field", () => {
    try {
      completeStageRequestSchema.parse({});
      assert.fail("expected validation error");
    } catch (error) {
      assert.ok(error instanceof SchemaValidationError);
      assert.equal(error.field, "stage");
      assert.equal(error.value, undefined);
      assert.match(error.formatMessage(), /\(missing\)/);
    }
  });
});
