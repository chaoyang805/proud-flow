// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createApiApp, createRequirement, json, request } from "./api-test-utils";

describe("requirements API", () => {
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
});
