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

describe("requirement.updated realtime broadcast", () => {
  it("broadcasts when skill start-stage updates requirement status", async () => {
    const events = [];
    const app = createApiApp();
    app.hub.registerRealtimeClient((event) => events.push(event));

    const { body, env } = await bootstrapLocal(app);
    await createRequirement(app);

    const started = await json(
      await request(
        app,
        "/api/skills/requirements/REQ-000001/start-stage",
        {
          method: "POST",
          headers: auth(body.tokens.skill),
          body: { stage: "tech_design" },
        },
        env,
      ),
    );
    assert.equal(started.requirement.status, "tech-design");

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(events.length, 1);
    assert.equal(events[0].type, "requirement.updated");
    assert.equal(events[0].requirementId, "REQ-000001");
    assert.equal(events[0].status, "tech-design");
    assert.match(events[0].message, /技术方案/);
  });

  it("broadcasts when workflow complete-stage updates requirement status", async () => {
    const events = [];
    const app = createApiApp();
    app.hub.registerRealtimeClient((event) => events.push(event));
    await createRequirement(app);

    await request(app, "/api/requirements/REQ-000001/workflow/start-stage", {
      method: "POST",
      body: { stage: "tech_design" },
    });
    await request(app, "/api/requirements/REQ-000001/artifacts", {
      method: "POST",
      body: {
        type: "tech_design_pr",
        title: "技术方案 PR",
        url: "https://example.test/pr/1",
      },
    });

    const completed = await json(
      await request(app, "/api/requirements/REQ-000001/workflow/complete-stage", {
        method: "POST",
        body: { stage: "tech_design" },
      }),
    );
    assert.equal(completed.requirement.status, "tech-review");

    await new Promise((resolve) => setTimeout(resolve, 0));

    const updatedEvents = events.filter((event) => event.type === "requirement.updated");
    assert.equal(updatedEvents.length, 2);
    assert.equal(updatedEvents.at(-1).status, "tech-review");
    assert.equal(updatedEvents.at(-1).requirementId, "REQ-000001");
  });
});
