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

describe("dispatch lifecycle API", () => {
  it("queues dispatch requests, lets dispatchers pull and ack them, and records realtime events", async () => {
    const app = createApiApp();
    const { env, body } = await bootstrapLocal(app);
    await createRequirement(app);

    const dispatched = await json(
      await request(app, "/api/requirements/REQ-000001/dispatch", {
        method: "POST",
        body: { stage: "tech_design" },
      }),
    );
    assert.equal(dispatched.accepted, true);
    assert.equal(dispatched.stage, "tech_design");

    const forbidden = await json(
      await request(
        app,
        "/api/dispatch/next",
        { headers: auth(body.tokens.skill) },
        env,
      ),
    );
    assert.equal(forbidden.error.code, "FORBIDDEN");

    const pending = await json(
      await request(
        app,
        "/api/dispatch/next",
        { headers: auth(body.tokens.dispatcher) },
        env,
      ),
    );
    assert.equal(pending.type, "dispatch.requested");
    assert.equal(pending.requirementId, "REQ-000001");
    assert.equal(pending.stage, "tech_design");

    const ack = await json(
      await request(
        app,
        "/api/dispatch/ack",
        {
          method: "POST",
          headers: auth(body.tokens.dispatcher),
          body: {
            type: "dispatch.acked",
            requestId: pending.requestId,
            success: true,
          },
        },
        env,
      ),
    );
    assert.equal(ack.acknowledged, true);

    const empty = await json(
      await request(
        app,
        "/api/dispatch/next",
        { headers: auth(body.tokens.dispatcher) },
        env,
      ),
    );
    assert.equal(empty.empty, true);

    const events = await json(await request(app, "/api/realtime/events"));
    assert.deepEqual(events.items, [
      {
        type: "dispatch.acked",
        eventId: "evt_000001",
        requirementId: "REQ-000001",
        success: true,
        message: "Dispatch acknowledged",
      },
    ]);
  });

  it("rejects dispatch from statuses that are not ready for the requested stage", async () => {
    const app = createApiApp();
    await createRequirement(app);

    const invalid = await json(
      await request(app, "/api/requirements/REQ-000001/dispatch", {
        method: "POST",
        body: { stage: "case_rundown" },
      }),
    );

    assert.equal(invalid.error.code, "INVALID_STATUS_TRANSITION");
  });
});
