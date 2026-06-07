// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  hashToken,
  schemaSql,
  verifyTokenHash,
} from "../../src/test-utils";
import { createApiApp, createRequirement, json, request } from "./api-test-utils";

describe("artifacts and API auth", () => {
  it("uploads artifacts through R2 binding and lists artifacts", async () => {
    const writes = [];
    const app = createApiApp();
    await createRequirement(app);

    const uploaded = await json(
      await request(
        app,
        "/api/requirements/REQ-000001/artifacts/upload",
        {
          method: "POST",
          body: {
            type: "note",
            title: "上传",
            fileName: "a.txt",
            contentType: "text/plain",
            contentBase64: "YQ==",
          },
        },
        { ARTIFACT_BUCKET: { put: async (...args) => writes.push(args) } },
      ),
    );
    assert.equal(uploaded.url.startsWith("r2://REQ-000001/"), true);
    assert.equal(writes.length, 1);

    const artifacts = await json(
      await request(app, "/api/requirements/REQ-000001/artifacts"),
    );
    assert.equal(artifacts.items.length, 1);
  });

  it("checks auth token hashes, schema SQL, not found and validation errors", async () => {
    assert.equal(
      schemaSql.includes("CREATE TABLE IF NOT EXISTS requirements"),
      true,
    );
    const hash = await hashToken("secret-token", "pepper");
    assert.equal(await verifyTokenHash("secret-token", [hash], "pepper"), true);

    const app = createApiApp();
    const unauthorized = await request(
      app,
      "/api/requirements",
      {},
      { USER_TOKEN_HASHES: hash, TOKEN_HASH_SECRET: "pepper" },
    );
    assert.equal(unauthorized.status, 401);

    const authorized = await request(
      app,
      "/api/requirements",
      { headers: { Authorization: "Bearer secret-token" } },
      { USER_TOKEN_HASHES: hash, TOKEN_HASH_SECRET: "pepper" },
    );
    assert.equal(authorized.status, 200);

    const notFound = await json(await request(app, "/api/missing"));
    assert.equal(notFound.error.code, "NOT_FOUND");

    const invalid = await json(
      await request(app, "/api/requirements", {
        method: "POST",
        body: { title: "", description: "描述", priority: "high" },
      }),
    );
    assert.equal(invalid.error.code, "VALIDATION_ERROR");
  });
});
