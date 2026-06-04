// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createApiApp, createRequirement, json, request } from "./api-test-utils";

describe("workflow and review API", () => {
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
});
