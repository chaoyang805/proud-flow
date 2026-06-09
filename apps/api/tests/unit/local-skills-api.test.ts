// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  auth,
  bootstrapLocal,
  createApiApp,
  createRequirement,
  json,
  request,
} from "./api-test-utils";

describe("Local API and Skills API", () => {
  it("bootstraps local, skill, and dispatcher tokens while storing only hashes", async () => {
    const app = createApiApp();
    const { body } = await bootstrapLocal(app);

    assert.match(body.tokens.skill, /^pf_skill_/);
    assert.match(body.tokens.dispatcher, /^pf_dispatcher_/);
    assert.match(body.tokens.local, /^pf_local_/);
    assert.equal(body.tokens.skill.includes("bootstrap-secret"), false);

    const manifest = await request(app, "/api/local/skills/manifest");
    assert.equal(manifest.status, 404);
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
