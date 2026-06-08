// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  createDoRequest,
  DO_INTERNAL_ORIGIN,
  DO_PATH_BROADCAST,
  DO_PATH_DISPATCH,
  DO_PATH_STATUS,
  DO_PATH_WS,
  getDoPath,
} from "../../src/durable-objects/do-request";

describe("do-request helpers", () => {
  it("creates internal DO requests with stable origin and path", () => {
    const request = createDoRequest(DO_PATH_DISPATCH, {
      method: "POST",
      body: "{}",
    });
    assert.equal(request.url, `${DO_INTERNAL_ORIGIN}${DO_PATH_DISPATCH}`);
    assert.equal(request.method, "POST");
  });

  it("extracts pathname from DO requests", () => {
    assert.equal(
      getDoPath(new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_WS}`)),
      DO_PATH_WS,
    );
    assert.equal(
      getDoPath(new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_STATUS}`)),
      DO_PATH_STATUS,
    );
    assert.equal(
      getDoPath(new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_BROADCAST}`)),
      DO_PATH_BROADCAST,
    );
  });
});
