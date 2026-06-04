import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { getBackendUrl } from "../../src/index";

describe("CLI environment resolution", () => {
  it("resolves fixed backend URLs with developer override", () => {
    assert.equal(getBackendUrl("dev"), "http://127.0.0.1:8787");
    assert.equal(getBackendUrl("prod"), "https://api.proud-flow.example");
    assert.equal(
      getBackendUrl("dev", { PROUD_FLOW_API_URL: "http://localhost:9999" }),
      "http://localhost:9999",
    );
  });
});
