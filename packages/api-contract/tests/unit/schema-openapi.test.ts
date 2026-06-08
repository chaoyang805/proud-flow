// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  createOpenApiDocument,
  createRequirementRequestSchema,
  dispatchMessageSchema,
  dispatchPushResponseSchema,
  dispatchDoStatusResponseSchema,
  errorResponseSchema,
  localBootstrapResponseSchema,
  rotateTokenRequestSchema,
  rotateTokenResponseSchema,
  realtimeEventSchema,
  requirementResponseSchema,
  rollbackReviewRequestSchema,
  routeSpecs,
  skillManifestResponseSchema,
  taskContextResponseSchema,
} from "../../src/index";

const requirement = {
  id: "REQ-000123",
  title: "需求",
  description: "描述",
  status: "planning",
  priority: "high",
  version: 1,
  createdAt: "2026-06-04T00:00:00.000Z",
  updatedAt: "2026-06-04T00:00:00.000Z",
};

describe("api contract package", () => {
  it("validates requirement request and response schemas", () => {
    assert.deepEqual(
      createRequirementRequestSchema.parse({
        title: "A",
        description: "B",
        priority: "urgent",
      }),
      { title: "A", description: "B", priority: "urgent" },
    );
    assert.equal(requirementResponseSchema.is(requirement), true);
    assert.equal(
      createRequirementRequestSchema.is({
        title: "",
        description: "B",
        priority: "urgent",
      }),
      false,
    );
  });

  it("validates reviews, dispatch, realtime, skills, local, and error schemas", () => {
    assert.equal(
      rollbackReviewRequestSchema.is({
        targetStatus: "planning",
        reason: "返工",
      }),
      true,
    );
    assert.equal(
      dispatchMessageSchema.is({
        type: "dispatch.requested",
        requestId: "dispatch_req_1",
        requirementId: "REQ-000123",
        stage: "tech_design",
      }),
      true,
    );
    assert.equal(
      dispatchPushResponseSchema.is({
        accepted: true,
        requestId: "dispatch_req_1",
        ack: { success: false, errorMessage: "Codex offline" },
      }),
      true,
    );
    assert.equal(
      dispatchDoStatusResponseSchema.is({ online: false, connectionCount: 0 }),
      true,
    );
    assert.equal(
      realtimeEventSchema.is({
        type: "ai_stage.failed",
        eventId: "evt_1",
        requirementId: "REQ-000123",
        stage: "development",
        message: "失败",
      }),
      true,
    );
    assert.equal(
      taskContextResponseSchema.is({
        requirement,
        currentArtifacts: { items: [] },
        historicalArtifacts: { items: [] },
        requiredArtifactTypes: ["tech_design_pr"],
        allowedActions: ["complete-stage"],
      }),
      true,
    );
    assert.equal(
      localBootstrapResponseSchema.is({
        tokens: {
          skill: "pf_skill_abc",
          dispatcher: "pf_dispatcher_abc",
          local: "pf_local_abc",
        },
      }),
      true,
    );
    assert.equal(rotateTokenRequestSchema.is({ tokenType: "local" }), true);
    assert.equal(
      rotateTokenResponseSchema.is({ token: "pf_local_new" }),
      true,
    );
    assert.equal(
      skillManifestResponseSchema.is({
        version: "0.1.0",
        cliVersionRange: ">=0.1.0",
        skills: [
          {
            name: "tech-design",
            version: "0.1.0",
            downloadUrl: "https://example.test/skill.tgz",
            sha256: "abc",
          },
        ],
      }),
      true,
    );
    assert.equal(
      errorResponseSchema.is({
        error: { code: "INVALID_STATUS_TRANSITION", message: "状态错误" },
      }),
      true,
    );
  });

  it("generates OpenAPI paths from reusable route specs", () => {
    const document = createOpenApiDocument();
    assert.equal(document.openapi, "3.1.0");
    assert.equal(routeSpecs.length >= 20, true);
    assert.ok(document.paths["/api/requirements"]);
    assert.ok(document.paths["/api/skills/requirements/{id}/complete-stage"]);
    assert.ok(document.paths["/api/local/skills/manifest"]);
  });
});
