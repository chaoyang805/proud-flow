// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  createProudFlowApiClient,
  ProudFlowApiError,
  staticTokenProvider,
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

function createMockFetch(handler) {
  const calls = [];
  const mock = async (url, init) => {
    calls.push({ url: String(url), init });
    const result = handler(String(url), init ?? {});
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
    });
  };
  mock.calls = calls;
  return mock;
}

describe("api client package", () => {
  it("injects user tokens and validates requirement responses", async () => {
    const mockFetch = createMockFetch(() => ({ body: requirement }));
    const client = createProudFlowApiClient({
      baseUrl: "https://api.example.test/",
      token: "pf_user_abc",
      fetch: mockFetch,
    });

    const created = await client.requirements.create({
      title: "需求",
      description: "描述",
      priority: "high",
    });

    assert.deepEqual(created, requirement);
    assert.equal(
      mockFetch.calls[0].url,
      "https://api.example.test/api/requirements",
    );
    assert.equal(
      mockFetch.calls[0].init.headers.Authorization,
      "Bearer pf_user_abc",
    );
  });

  it("exposes skills, local, dispatch, reviews, and artifacts clients", async () => {
    const mockFetch = createMockFetch((url) => {
      if (url.endsWith("/dispatch"))
        return {
          body: {
            requestId: "dispatch_req_1",
            stage: "tech_design",
            accepted: true,
          },
        };
      if (url.endsWith("/task-context"))
        return {
          body: {
            requirement,
            currentArtifacts: { items: [] },
            historicalArtifacts: { items: [] },
            requiredArtifactTypes: ["tech_design_pr"],
            allowedActions: ["complete-stage"],
          },
        };
      if (url.endsWith("/artifacts")) return { body: { items: [] } };
      if (
        url.includes("/reviews/") ||
        url.includes("/status/start") ||
        url.includes("/complete-stage") ||
        url.includes("/fail-stage") ||
        url.includes("/notes")
      )
        return { body: { requirement } };
      return { body: requirement };
    });
    const client = createProudFlowApiClient({
      baseUrl: "https://api.example.test",
      fetch: mockFetch,
    });

    assert.equal(
      (await client.dispatch.dispatch("REQ-000123", { stage: "tech_design" }))
        .accepted,
      true,
    );
    assert.equal(
      (await client.skills.getTaskContext("REQ-000123")).requirement.id,
      "REQ-000123",
    );
    assert.deepEqual((await client.artifacts.list("REQ-000123")).items, []);
    assert.equal(
      (await client.reviews.approve("REQ-000123", { note: "通过" })).requirement
        .id,
      "REQ-000123",
    );
  });

  it("covers every generated REST helper method", async () => {
    const artifact = {
      id: "art_1",
      requirementId: "REQ-000123",
      requirementVersion: 1,
      type: "note",
      title: "备注",
      createdAt: "2026-06-04T00:00:00.000Z",
    };
    const mockFetch = createMockFetch((url, init) => {
      if (url.endsWith("/api/requirements") && init.method === "GET")
        return { body: { items: [requirement] } };
      if (url.endsWith("/archive")) return { body: { archived: true } };
      if (url.endsWith("/artifacts") && init.method === "GET")
        return { body: { items: [artifact] } };
      if (url.includes("/tokens/rotate"))
        return { body: { token: "pf_skill_new" } };
      if (url.includes("/tokens/revoke")) return { body: {} };
      if (url.includes("/bootstrap"))
        return {
          body: {
            tokens: {
              skill: "pf_skill_abc",
              dispatcher: "pf_dispatcher_abc",
              local: "pf_local_abc",
            },
          },
        };
      if (
        url.includes("/artifacts/upload") ||
        (url.includes("/artifacts") && !url.endsWith("/artifacts"))
      )
        return { body: artifact };
      if (url.endsWith("/artifacts")) return { body: artifact };
      if (
        url.includes("/reviews/") ||
        url.includes("/status/start") ||
        url.includes("/complete-stage") ||
        url.includes("/fail-stage") ||
        url.includes("/notes")
      )
        return { body: { requirement } };
      return { body: requirement };
    });
    const client = createProudFlowApiClient({
      baseUrl: "https://api.example.test",
      fetch: mockFetch,
    });

    assert.equal((await client.requirements.list()).items.length, 1);
    assert.deepEqual(await client.requirements.archive("REQ-000123"), {
      archived: true,
    });
    assert.equal(
      (await client.requirements.update("REQ-000123", { title: "新标题" })).id,
      "REQ-000123",
    );
    assert.equal(
      (
        await client.reviews.rollback("REQ-000123", {
          targetStatus: "planning",
          reason: "返工",
        })
      ).requirement.id,
      "REQ-000123",
    );
    assert.equal(
      (
        await client.artifacts.create("REQ-000123", {
          type: "note",
          title: "备注",
          content: "内容",
        })
      ).id,
      "art_1",
    );
    assert.equal(
      (
        await client.artifacts.upload({
          type: "note",
          title: "备注",
          fileName: "a.txt",
          contentType: "text/plain",
          contentBase64: "YQ==",
        })
      ).id,
      "art_1",
    );
    assert.equal(
      (await client.skills.getRequirement("REQ-000123")).id,
      "REQ-000123",
    );
    assert.equal(
      (await client.skills.startStage("REQ-000123", { stage: "tech_design" }))
        .requirement.id,
      "REQ-000123",
    );
    assert.equal(
      (
        await client.skills.attachArtifact("REQ-000123", {
          type: "note",
          title: "备注",
          content: "内容",
        })
      ).id,
      "art_1",
    );
    assert.equal(
      (
        await client.skills.uploadArtifact("REQ-000123", {
          type: "note",
          title: "备注",
          fileName: "a.txt",
          contentType: "text/plain",
          contentBase64: "YQ==",
        })
      ).id,
      "art_1",
    );
    assert.equal(
      (
        await client.skills.completeStage("REQ-000123", {
          stage: "tech_design",
        })
      ).requirement.id,
      "REQ-000123",
    );
    assert.equal(
      (
        await client.skills.failStage("REQ-000123", {
          stage: "tech_design",
          message: "失败",
        })
      ).requirement.id,
      "REQ-000123",
    );
    assert.equal(
      (await client.skills.addNote("REQ-000123", { message: "备注" }))
        .requirement.id,
      "REQ-000123",
    );
    assert.equal(
      (
        await client.local.bootstrap({
          bootstrapToken: "boot",
          machineName: "dev",
        })
      ).tokens.skill,
      "pf_skill_abc",
    );
    assert.equal(
      (await client.local.rotateToken({ tokenType: "skill" })).token,
      "pf_skill_new",
    );
    assert.deepEqual(
      await client.local.revokeToken({ tokenType: "skill" }),
      {},
    );
  });

  it("maps malformed API errors to INTERNAL_ERROR", async () => {
    const mockFetch = createMockFetch(() => ({
      status: 500,
      body: { unexpected: true },
    }));
    const client = createProudFlowApiClient({
      baseUrl: "https://api.example.test",
      fetch: mockFetch,
    });

    await assert.rejects(
      () => client.requirements.get("REQ-000123"),
      (error) => {
        assert.equal(error instanceof ProudFlowApiError, true);
        assert.equal(error.code, "INTERNAL_ERROR");
        return true;
      },
    );
  });

  it("maps API errors and keeps token storage outside the client", async () => {
    const provider = staticTokenProvider("pf_skill_abc");
    const mockFetch = createMockFetch(() => ({
      status: 409,
      body: {
        error: { code: "INVALID_STATUS_TRANSITION", message: "状态错误" },
      },
    }));
    const client = createProudFlowApiClient({
      baseUrl: "https://api.example.test",
      token: provider.getToken(),
      fetch: mockFetch,
    });

    await assert.rejects(
      () => client.requirements.get("REQ-000123"),
      (error) => {
        assert.equal(error instanceof ProudFlowApiError, true);
        assert.equal(error.code, "INVALID_STATUS_TRANSITION");
        assert.equal(error.status, 409);
        return true;
      },
    );
  });

  it("staticTokenProvider returns token when set", () => {
    const provider = staticTokenProvider("my-token");
    assert.equal(provider.getToken(), "my-token");
  });

  it("staticTokenProvider returns undefined when token not set", () => {
    const provider = staticTokenProvider(undefined);
    assert.equal(provider.getToken(), undefined);
  });

  it("ProudFlowApiError carries all fields", () => {
    const error = new ProudFlowApiError(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "bad request",
        details: [{ field: "title", message: "required" }],
      },
    });
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.equal(error.status, 400);
    assert.equal(error.message, "bad request");
    assert.equal(error.details.length, 1);
    assert.equal(error.name, "ProudFlowApiError");
  });
});
