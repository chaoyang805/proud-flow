import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createApiApp,
  hashToken,
  schemaSql,
  verifyTokenHash,
} from "../../dist/index.js";

async function json(response) {
  return response.json();
}

async function request(app, path, options = {}, env) {
  return app.fetch(
    new Request(`https://api.test${path}`, {
      method: options.method ?? "GET",
      headers: options.body
        ? { "Content-Type": "application/json", ...(options.headers ?? {}) }
        : options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
    env,
  );
}

async function createRequirement(app) {
  const response = await request(app, "/api/requirements", {
    method: "POST",
    body: { title: "需求", description: "描述", priority: "high" },
  });
  assert.equal(response.status, 201);
  return json(response);
}

describe("P2 backend core API", () => {
  it("creates, lists, gets, and updates planning requirements", async () => {
    const app = createApiApp();
    const created = await createRequirement(app);

    assert.equal(created.id, "REQ-000001");
    assert.equal(created.status, "planning");
    assert.equal(created.version, 1);

    const list = await json(await request(app, "/api/requirements"));
    assert.equal(list.items.length, 1);

    const got = await json(await request(app, "/api/requirements/REQ-000001"));
    assert.equal(got.title, "需求");

    const updated = await json(
      await request(app, "/api/requirements/REQ-000001", {
        method: "PATCH",
        body: { title: "新需求" },
      }),
    );
    assert.equal(updated.title, "新需求");
  });

  it("enforces workflow transitions and required artifacts", async () => {
    const app = createApiApp();
    await createRequirement(app);

    const started = await json(
      await request(app, "/api/requirements/REQ-000001/workflow/start-stage", {
        method: "POST",
        body: { stage: "tech_design" },
      }),
    );
    assert.equal(started.requirement.status, "tech-design");

    const missing = await json(
      await request(
        app,
        "/api/requirements/REQ-000001/workflow/complete-stage",
        {
          method: "POST",
          body: { stage: "tech_design" },
        },
      ),
    );
    assert.equal(missing.error.code, "MISSING_REQUIRED_ARTIFACT");

    const artifact = await json(
      await request(app, "/api/requirements/REQ-000001/artifacts", {
        method: "POST",
        body: {
          type: "tech_design_pr",
          title: "技术方案 PR",
          url: "https://example.test/pr/1",
        },
      }),
    );
    assert.equal(artifact.requirementVersion, 1);

    const completed = await json(
      await request(
        app,
        "/api/requirements/REQ-000001/workflow/complete-stage",
        {
          method: "POST",
          body: { stage: "tech_design" },
        },
      ),
    );
    assert.equal(completed.requirement.status, "tech-review");

    const editAfterAi = await json(
      await request(app, "/api/requirements/REQ-000001", {
        method: "PATCH",
        body: { title: "禁止编辑" },
      }),
    );
    assert.equal(editAfterAi.error.code, "INVALID_STATUS_TRANSITION");
  });

  it("approves reviews, rolls back with version increment, and archives with acceptance artifact", async () => {
    const app = createApiApp();
    await createRequirement(app);
    await request(app, "/api/requirements/REQ-000001/workflow/start-stage", {
      method: "POST",
      body: { stage: "tech_design" },
    });
    await request(app, "/api/requirements/REQ-000001/artifacts", {
      method: "POST",
      body: {
        type: "tech_design_pr",
        title: "PR",
        url: "https://example.test/pr/1",
      },
    });
    await request(app, "/api/requirements/REQ-000001/workflow/complete-stage", {
      method: "POST",
      body: { stage: "tech_design" },
    });

    const approved = await json(
      await request(app, "/api/requirements/REQ-000001/reviews/approve", {
        method: "POST",
        body: { note: "通过" },
      }),
    );
    assert.equal(approved.requirement.status, "case-rundown");

    await request(app, "/api/requirements/REQ-000001/workflow/complete-stage", {
      method: "POST",
      body: { stage: "case_rundown" },
    });
    const badRollback = await json(
      await request(app, "/api/requirements/REQ-000001/reviews/rollback", {
        method: "POST",
        body: { targetStatus: "delivery", reason: "bad" },
      }),
    );
    assert.equal(badRollback.error.code, "INVALID_STATUS_TRANSITION");

    await request(app, "/api/requirements/REQ-000001/artifacts", {
      method: "POST",
      body: { type: "case_rundown_doc", title: "用例" },
    });
    await request(app, "/api/requirements/REQ-000001/workflow/complete-stage", {
      method: "POST",
      body: { stage: "case_rundown" },
    });
    const rollback = await json(
      await request(app, "/api/requirements/REQ-000001/reviews/rollback", {
        method: "POST",
        body: { targetStatus: "planning", reason: "补充需求" },
      }),
    );
    assert.equal(rollback.requirement.status, "planning");
    assert.equal(rollback.requirement.version, 2);

    const app2 = createApiApp();
    await createRequirement(app2);
    await request(app2, "/api/requirements/REQ-000001/workflow/start-stage", {
      method: "POST",
      body: { stage: "tech_design" },
    });
    await request(app2, "/api/requirements/REQ-000001/artifacts", {
      method: "POST",
      body: { type: "tech_design_pr", title: "PR" },
    });
    await request(
      app2,
      "/api/requirements/REQ-000001/workflow/complete-stage",
      { method: "POST", body: { stage: "tech_design" } },
    );
    await request(app2, "/api/requirements/REQ-000001/reviews/approve", {
      method: "POST",
      body: { note: "ok" },
    });
    await request(app2, "/api/requirements/REQ-000001/artifacts", {
      method: "POST",
      body: { type: "case_rundown_pr", title: "case" },
    });
    await request(
      app2,
      "/api/requirements/REQ-000001/workflow/complete-stage",
      { method: "POST", body: { stage: "case_rundown" } },
    );
    await request(app2, "/api/requirements/REQ-000001/reviews/approve", {
      method: "POST",
      body: { note: "ok" },
    });
    await request(app2, "/api/requirements/REQ-000001/artifacts", {
      method: "POST",
      body: { type: "development_pr", title: "dev" },
    });
    await request(
      app2,
      "/api/requirements/REQ-000001/workflow/complete-stage",
      { method: "POST", body: { stage: "development" } },
    );

    const missingAcceptance = await json(
      await request(app2, "/api/requirements/REQ-000001/archive", {
        method: "POST",
      }),
    );
    assert.equal(missingAcceptance.error.code, "MISSING_REQUIRED_ARTIFACT");

    await request(app2, "/api/requirements/REQ-000001/artifacts", {
      method: "POST",
      body: { type: "acceptance_record", title: "验收" },
    });
    const archived = await json(
      await request(app2, "/api/requirements/REQ-000001/archive", {
        method: "POST",
      }),
    );
    assert.equal(archived.archived, true);
    const finalRequirement = await json(
      await request(app2, "/api/requirements/REQ-000001"),
    );
    assert.equal(finalRequirement.status, "archived");
  });

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
