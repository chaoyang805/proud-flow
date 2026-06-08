// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { RealtimeHub } from "../../src/modules/realtime/hub";

describe("RealtimeHub", () => {
  it("registers and unregisters dispatch clients", () => {
    const hub = new RealtimeHub();
    assert.equal(hub.hasDispatchClient(), false);

    const messages: any[] = [];
    const unregister = hub.registerDispatchClient((msg) => messages.push(msg));
    assert.equal(hub.hasDispatchClient(), true);

    hub.sendToDispatchClient({
      type: "dispatch.requested",
      requestId: "req_001",
      requirementId: "REQ-000001",
      stage: "tech_design",
    });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].requestId, "req_001");

    unregister();
    assert.equal(hub.hasDispatchClient(), false);
  });

  it("sendToDispatchClient returns false when no client connected", () => {
    const hub = new RealtimeHub();
    const result = hub.sendToDispatchClient({
      type: "dispatch.requested",
      requestId: "req_002",
      requirementId: "REQ-000001",
      stage: "development",
    });
    assert.equal(result, false);
  });

  it("registers and unregisters realtime clients", () => {
    const hub = new RealtimeHub();
    const events: any[] = [];

    const unregister = hub.registerRealtimeClient((evt) => events.push(evt));

    hub.broadcast({
      type: "dispatch.acked",
      eventId: "evt_001",
      requirementId: "REQ-000001",
      success: true,
      message: "Done",
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].eventId, "evt_001");
    assert.equal(events[0].type, "dispatch.acked");

    unregister();
    hub.broadcast({
      type: "dispatch.acked",
      eventId: "evt_002",
      requirementId: "REQ-000002",
      success: false,
      message: "Failed",
    });
    assert.equal(events.length, 1);
  });

  it("listRealtimeEvents returns all broadcast events", () => {
    const hub = new RealtimeHub();

    hub.broadcast({
      type: "dispatch.acked",
      eventId: "evt_001",
      requirementId: "REQ-000001",
      success: true,
      message: "Done",
    });
    hub.broadcast({
      type: "requirement.updated",
      eventId: "evt_002",
      requirementId: "REQ-000001",
      status: "tech-design",
      message: "Started",
    });

    const events = hub.listRealtimeEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0].type, "dispatch.acked");
    assert.equal(events[1].type, "requirement.updated");
  });

  it("broadcasts to multiple realtime clients simultaneously", () => {
    const hub = new RealtimeHub();
    const events1: any[] = [];
    const events2: any[] = [];

    hub.registerRealtimeClient((evt) => events1.push(evt));
    hub.registerRealtimeClient((evt) => events2.push(evt));

    hub.broadcast({
      type: "requirement.updated",
      eventId: "evt_003",
      requirementId: "REQ-000003",
      status: "developing",
      message: "Dispatched",
    });

    assert.equal(events1.length, 1);
    assert.equal(events2.length, 1);
    assert.equal(events1[0].eventId, "evt_003");
    assert.equal(events2[0].status, "developing");
  });

  it("handles disconnected client gracefully", () => {
    const hub = new RealtimeHub();

    // register a client that throws on send
    hub.registerRealtimeClient(() => { throw new Error("disconnected"); });

    // should not throw
    hub.broadcast({
      type: "dispatch.acked",
      eventId: "evt_004",
      requirementId: "REQ-000001",
      success: true,
      message: "OK",
    });

    // event still recorded
    assert.equal(hub.listRealtimeEvents().length, 1);
  });
});
