// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  dispatchPushResponseSchema,
  dispatchDoStatusResponseSchema,
} from "@proud-flow/api-contract";
import { pushDispatchViaDo } from "../../src/durable-objects/dispatch-client";
import { broadcastRealtimeViaDo } from "../../src/durable-objects/realtime-client";
import { hasDoBindings } from "../../src/durable-objects/stubs";
import { broadcastRealtimeEvent } from "../../src/modules/realtime/broadcast";
import { RealtimeHub } from "../../src/modules/realtime/hub";

describe("durable object clients", () => {
  it("detects DO bindings on env", () => {
    assert.equal(hasDoBindings({}), false);
    assert.equal(hasDoBindings({ DISPATCH_DO: {}, REALTIME_DO: {} }), true);
  });

  it("parses dispatch push responses", () => {
    assert.deepEqual(
      dispatchPushResponseSchema.parse({
        accepted: true,
        requestId: "dispatch_req_abc",
        ack: { success: true },
      }),
      {
        accepted: true,
        requestId: "dispatch_req_abc",
        ack: { success: true },
      },
    );
    assert.equal(
      dispatchPushResponseSchema.is({
        accepted: false,
        code: "DISPATCH_TIMEOUT",
      }),
      true,
    );
    assert.equal(
      dispatchDoStatusResponseSchema.is({ online: true, connectionCount: 1 }),
      true,
    );
  });

  it("pushDispatchViaDo calls DO /dispatch endpoint", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const stub = {
      async fetch(input: Request) {
        calls.push({
          url: String(input.url),
          body: await input.text(),
        });
        return Response.json({
          accepted: true,
          requestId: "dispatch_req_abc",
          ack: { success: true },
        });
      },
    };

    const result = await pushDispatchViaDo(stub, {
      type: "dispatch.requested",
      requestId: "dispatch_req_abc",
      requirementId: "REQ-000001",
      stage: "tech_design",
    });

    assert.equal(result.accepted, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/dispatch$/);
    assert.match(calls[0].body, /REQ-000001/);
  });

  it("broadcastRealtimeViaDo posts events to DO /broadcast", async () => {
    let body = "";
    const stub = {
      async fetch(input: Request) {
        body = await input.text();
        return Response.json({ ok: true });
      },
    };

    await broadcastRealtimeViaDo(stub, {
      type: "dispatch.acked",
      eventId: "evt_1",
      requirementId: "REQ-000001",
      success: true,
      message: "ok",
    });

    assert.match(body, /dispatch\.acked/);
  });

  it("broadcastRealtimeEvent falls back to hub without DO bindings", async () => {
    const hub = new RealtimeHub();
    const events: unknown[] = [];
    hub.registerRealtimeClient((event) => {
      events.push(event);
    });

    await broadcastRealtimeEvent({}, hub, {
      type: "requirement.updated",
      eventId: "evt_2",
      requirementId: "REQ-000002",
      status: "planning",
      message: "updated",
    });

    assert.equal(events.length, 1);
  });
});
