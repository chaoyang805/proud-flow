import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateCliApiClient, cliApp } from "../../dist/index.js";

describe("cli app scaffold", () => {
  it("resolves the shared api client", () => {
    assert.equal(cliApp.name, "@proud-flow/cli");
    assert.equal(canCreateCliApiClient(), true);
  });
});
