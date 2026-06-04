import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateWebApiClient, webApp } from "../../dist/index.js";

describe("web app scaffold", () => {
  it("resolves the shared api client", () => {
    assert.equal(webApp.name, "@proud-flow/web");
    assert.equal(canCreateWebApiClient(), true);
  });
});
