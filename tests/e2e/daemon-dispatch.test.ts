import { describe, expect, it } from "vitest";
import { createApiApp, hashToken } from "../../apps/api/src/test-utils";
import {
  createDaemon,
  createMemoryCliRuntime,
  createMockAgentRunner,
  runCli,
} from "../../apps/cli/src/index";

async function readJson(response: Response) {
  return response.json();
}

describe("daemon dispatch source e2e", () => {
  it("bootstraps dispatcher auth and ACKs a dispatch request with a fixed Skill command", async () => {
    const app = createApiApp();
    const bootstrapHash = await hashToken("daemon-bootstrap", "pepper");
    const env = {
      BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
      TOKEN_HASH_SECRET: "pepper",
    };
    const runtime = createMemoryCliRuntime({
      fetch: (url, init) =>
        app.fetch(
          new Request(url, {
            method: init?.method,
            headers: init?.headers,
            body: init?.body,
          }),
          env,
        ),
      env: { PROUD_FLOW_API_URL: "https://api.test" },
    });

    const init = await runCli(
      [
        "init",
        "--env",
        "dev",
        "--bootstrap-token",
        "daemon-bootstrap",
        "--machine-name",
        "e2e-daemon",
      ],
      runtime,
    );
    expect(init.exitCode).toBe(0);

    const dispatcherToken = await runtime.keychain.getToken("dispatcher");
    expect(dispatcherToken).toMatch(/^pf_dispatcher_/);

    const ws = await app.fetch(
      new Request("https://api.test/api/dispatch/ws", {
        headers: { Authorization: `Bearer ${dispatcherToken}` },
      }),
      env,
    );
    expect(ws.status).toBe(426);

    const runner = createMockAgentRunner();
    const sent: unknown[] = [];
    const daemon = createDaemon({
      runner,
      send: async (message) => {
        sent.push(message);
      },
    });

    await daemon.receive({
      type: "dispatch.requested",
      requestId: "dispatch_req_e2e",
      requirementId: "REQ-000123",
      stage: "tech_design",
    });

    expect(runner.calls).toEqual([
      { stage: "tech_design", requirementId: "REQ-000123" },
    ]);
    expect(sent).toEqual([
      {
        type: "dispatch.acked",
        requestId: "dispatch_req_e2e",
        success: true,
      },
    ]);

    const forbidden = await readJson(
      await app.fetch(
        new Request("https://api.test/api/dispatch/ws", {
          headers: { Authorization: `Bearer ${await runtime.keychain.getToken("skill")}` },
        }),
        env,
      ),
    );
    expect(forbidden.error.code).toBe("FORBIDDEN");
  });
});
