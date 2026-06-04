// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { canCreateWebApiClient, webApp } from "../../src/index";

describe("web app scaffold", () => {
  it("resolves the shared api client", () => {
    assert.equal(webApp.name, "@proud-flow/web");
    assert.equal(canCreateWebApiClient(), true);
  });
});
