// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  createApiApp,
  createRequirement,
  json,
  request,
} from "./api-test-utils";

describe("dispatch lifecycle API", () => {
  it("rejects dispatch when no daemon is connected", async () => {
    const app = createApiApp();
    await createRequirement(app);

    const res = await json(
      await request(app, "/api/requirements/REQ-000001/dispatch", {
        method: "POST",
        body: { stage: "tech_design" },
      }),
    );

    assert.equal(res.error.code, "DISPATCHER_OFFLINE");
  });

  it("rejects dispatch from invalid status", async () => {
    const app = createApiApp();
    await createRequirement(app);

    const res = await json(
      await request(app, "/api/requirements/REQ-000001/dispatch", {
        method: "POST",
        body: { stage: "case_rundown" },
      }),
    );

    assert.equal(res.error.code, "INVALID_STATUS_TRANSITION");
  });

  it("registers and unregisters dispatch client", () => {
    const app = createApiApp();
    const hub = app.hub;

    assert.equal(hub.hasDispatchClient(), false);

    const unregister = hub.registerDispatchClient(() => {});
    assert.equal(hub.hasDispatchClient(), true);

    unregister();
    assert.equal(hub.hasDispatchClient(), false);
  });
});
