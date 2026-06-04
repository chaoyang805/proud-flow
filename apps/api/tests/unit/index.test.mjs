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

describe("P3 Skills API and Local API", () => {
  async function bootstrapLocal(app) {
    const bootstrapHash = await hashToken("bootstrap-secret", "pepper");
    const env = {
      BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
      TOKEN_HASH_SECRET: "pepper",
    };
    const response = await request(
      app,
      "/api/local/bootstrap",
      {
        method: "POST",
        body: { bootstrapToken: "bootstrap-secret", machineName: "dev-mac" },
      },
      env,
    );
    assert.equal(response.status, 201);
    return { env, body: await json(response) };
  }

  function auth(token) {
    return { Authorization: `Bearer ${token}` };
  }

  it("bootstraps local, skill, and dispatcher tokens while storing only hashes", async () => {
    const app = createApiApp();
    const { body } = await bootstrapLocal(app);

    assert.match(body.tokens.skill, /^pf_skill_/);
    assert.match(body.tokens.dispatcher, /^pf_dispatcher_/);
    assert.match(body.tokens.local, /^pf_local_/);
    assert.equal(body.tokens.skill.includes("bootstrap-secret"), false);

    const manifest = await json(
      await request(app, "/api/local/skills/manifest"),
    );
    assert.equal(manifest.version, "0.1.0");
    assert.equal(manifest.skills.length, 3);
    assert.equal(
      manifest.skills.every((skill) => skill.sha256.length >= 64),
      true,
    );
  });

  it("enforces token boundaries across user, skill, and local APIs", async () => {
    const app = createApiApp();
    const { body, env } = await bootstrapLocal(app);
    await createRequirement(app);

    const skillRequirement = await request(
      app,
      "/api/skills/requirements/REQ-000001",
      { headers: auth(body.tokens.skill) },
      env,
    );
    assert.equal(skillRequirement.status, 200);

    const skillCannotUseUserApi = await json(
      await request(
        app,
        "/api/requirements",
        { headers: auth(body.tokens.skill) },
        env,
      ),
    );
    assert.equal(skillCannotUseUserApi.error.code, "FORBIDDEN");

    const localCannotUseSkillsApi = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001",
        { headers: auth(body.tokens.local) },
        env,
      ),
    );
    assert.equal(localCannotUseSkillsApi.error.code, "FORBIDDEN");

    const rotated = await json(
      await request(
        app,
        "/api/local/tokens/rotate",
        {
          method: "POST",
          headers: auth(body.tokens.local),
          body: { tokenType: "skill" },
        },
        env,
      ),
    );
    assert.match(rotated.token, /^pf_skill_/);
    assert.notEqual(rotated.token, body.tokens.skill);

    const oldSkill = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001",
        { headers: auth(body.tokens.skill) },
        env,
      ),
    );
    assert.equal(oldSkill.error.code, "FORBIDDEN");

    const newSkill = await request(
      app,
      "/api/skills/requirements/REQ-000001",
      { headers: auth(rotated.token) },
      env,
    );
    assert.equal(newSkill.status, 200);

    const revoked = await request(
      app,
      "/api/local/tokens/revoke",
      {
        method: "POST",
        headers: auth(body.tokens.local),
        body: { tokenType: "skill" },
      },
      env,
    );
    assert.equal(revoked.status, 200);

    const revokedSkill = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001",
        { headers: auth(rotated.token) },
        env,
      ),
    );
    assert.equal(revokedSkill.error.code, "FORBIDDEN");
  });

  it("lets skills read task context, attach artifacts, complete stages, fail stages, and append notes", async () => {
    const writes = [];
    const app = createApiApp();
    const { body, env } = await bootstrapLocal(app);
    const runtimeEnv = {
      ...env,
      ARTIFACT_BUCKET: { put: async (...args) => writes.push(args) },
    };
    await createRequirement(app);

    const started = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/status/start",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: { stage: "tech_design" },
        },
        runtimeEnv,
      ),
    );
    assert.equal(started.requirement.status, "tech-design");

    const context = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/task-context",
        { headers: auth(body.tokens.skill) },
        runtimeEnv,
      ),
    );
    assert.equal(context.requirement.status, "tech-design");
    assert.deepEqual(context.requiredArtifactTypes, ["tech_design_pr"]);
    assert.equal(context.allowedActions.includes("complete-stage"), true);

    const missing = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/complete-stage",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: { stage: "tech_design" },
        },
        runtimeEnv,
      ),
    );
    assert.equal(missing.error.code, "MISSING_REQUIRED_ARTIFACT");

    const artifact = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/artifacts",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: {
            type: "tech_design_pr",
            title: "技术方案 PR",
            url: "https://example.test/pr/1",
          },
        },
        runtimeEnv,
      ),
    );
    assert.equal(artifact.requirementVersion, 1);

    const note = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/notes",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: { message: "补充说明" },
        },
        runtimeEnv,
      ),
    );
    assert.equal(note.type, "note");

    const completed = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/complete-stage",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: { stage: "tech_design" },
        },
        runtimeEnv,
      ),
    );
    assert.equal(completed.requirement.status, "tech-review");

    const failed = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/fail-stage",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: { stage: "case_rundown", message: "测试失败" },
        },
        runtimeEnv,
      ),
    );
    assert.equal(failed.requirement.status, "tech-review");
    assert.equal(failed.message, "测试失败");

    const uploaded = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/artifacts/upload",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: {
            type: "screenshot",
            title: "截图",
            fileName: "screen.png",
            contentType: "image/png",
            contentBase64: "YQ==",
          },
        },
        runtimeEnv,
      ),
    );
    assert.equal(uploaded.url.startsWith("r2://REQ-000001/"), true);
    assert.equal(writes.length, 1);
  });
});
