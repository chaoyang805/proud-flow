// @ts-nocheck
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { RealtimeDurableObject } from "../../src/durable-objects/realtime-do";
import { DO_INTERNAL_ORIGIN, DO_PATH_BROADCAST, DO_PATH_WS } from "../../src/durable-objects/do-request";

function createMockWebSocket() {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  return {
    sent: [] as string[],
    accept: vi.fn(),
    send(data: string) {
      this.sent.push(data);
    },
    addEventListener(type: string, handler: (event: unknown) => void) {
      const items = listeners.get(type) ?? [];
      items.push(handler);
      listeners.set(type, items);
    },
    emit(type: string, event: unknown) {
      for (const handler of listeners.get(type) ?? []) {
        handler(event);
      }
    },
  };
}

describe("RealtimeDurableObject", () => {
  let serverWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    serverWs = createMockWebSocket();
    globalThis.WebSocketPair = class {
      constructor() {
        return { 0: createMockWebSocket(), 1: serverWs };
      }
    };
    const ResponseCtor = globalThis.Response;
    const ResponseShim = function ResponseShim(body, init) {
      if (init?.status === 101) {
        const response = new ResponseCtor(body, { status: 200, headers: init.headers });
        Object.defineProperty(response, "webSocket", { value: init.webSocket });
        return response;
      }
      return new ResponseCtor(body, init);
    };
    Object.assign(ResponseShim, ResponseCtor);
    globalThis.Response = ResponseShim as typeof Response;
  });

  afterEach(() => {
    delete globalThis.WebSocketPair;
    globalThis.Response = Response;
  });

  it("broadcasts events to connected clients", async () => {
    const doInstance = new RealtimeDurableObject({} as DurableObjectState, {});

    const upgrade = await doInstance.fetch(
      new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_WS}`, {
        method: "GET",
        headers: { Upgrade: "websocket" },
      }),
    );
    assert.equal(upgrade.status, 200);

    const response = await doInstance.fetch(
      new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_BROADCAST}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "requirement.updated",
          eventId: "evt_1",
          requirementId: "REQ-000001",
          status: "planning",
          message: "updated",
        }),
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(serverWs.sent.length, 1);
    assert.match(serverWs.sent[0], /requirement\.updated/);
  });

  it("returns 426 when websocket upgrade header is missing", async () => {
    const doInstance = new RealtimeDurableObject({} as DurableObjectState, {});
    const response = await doInstance.fetch(
      new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_WS}`, { method: "GET" }),
    );
    assert.equal(response.status, 426);
  });
});
