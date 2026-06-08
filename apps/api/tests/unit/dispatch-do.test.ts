// @ts-nocheck
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { DispatchDurableObject } from "../../src/durable-objects/dispatch-do";
import { DO_INTERNAL_ORIGIN, DO_PATH_DISPATCH, DO_PATH_STATUS, DO_PATH_WS } from "../../src/durable-objects/do-request";

function createMockWebSocket() {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  return {
    sent: [] as string[],
    accept: vi.fn(),
    send(data: string) {
      this.sent.push(data);
    },
    close: vi.fn(),
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

describe("DispatchDurableObject", () => {
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
    vi.useRealTimers();
  });

  function createDo() {
    return new DispatchDurableObject({} as DurableObjectState, {
      REALTIME_DO: {
        idFromName: () => ({ toString: () => "realtime" }),
        get: () => ({
          async fetch() {
            return Response.json({ ok: true });
          },
        }),
      },
    });
  }

  it("returns status and offline dispatch responses", async () => {
    const doInstance = createDo();

    const status = await doInstance.fetch(
      new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_STATUS}`),
    );
    assert.deepEqual(await status.json(), { online: false, connectionCount: 0 });

    const offline = await doInstance.fetch(
      new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_DISPATCH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dispatch.requested",
          requestId: "dispatch_req_test",
          requirementId: "REQ-000001",
          stage: "tech_design",
        }),
      }),
    );
    assert.deepEqual(await offline.json(), {
      accepted: false,
      code: "DISPATCHER_OFFLINE",
    });
  });

  it("times out when daemon does not ack", async () => {
    vi.useFakeTimers();
    const doInstance = createDo();

    await doInstance.fetch(
      new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_WS}`, {
        method: "GET",
        headers: { Upgrade: "websocket" },
      }),
    );

    const dispatchPromise = doInstance.fetch(
      new Request(`${DO_INTERNAL_ORIGIN}${DO_PATH_DISPATCH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dispatch.requested",
          requestId: "dispatch_req_timeout",
          requirementId: "REQ-000003",
          stage: "tech_design",
        }),
      }),
    );

    await vi.advanceTimersByTimeAsync(5_100);
    const dispatch = await dispatchPromise;
    assert.deepEqual(await dispatch.json(), {
      accepted: false,
      code: "DISPATCH_TIMEOUT",
    });
  });
});
