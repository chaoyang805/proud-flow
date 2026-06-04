import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMemoryCliRuntime,
  getBackendUrl,
  runCli,
} from "../../dist/index.js";

function createMockFetch(handler) {
  const calls = [];
  const mock = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const result = handler(String(url), init);
    return new Response(JSON.stringify(result.body ?? {}), {
      status: result.status ?? 200,
    });
  };
  mock.calls = calls;
  return mock;
}

describe("P4 CLI helper", () => {
  it("resolves fixed backend URLs with developer override", () => {
    assert.equal(getBackendUrl("dev"), "http://127.0.0.1:8787");
    assert.equal(getBackendUrl("prod"), "https://api.proud-flow.example");
    assert.equal(
      getBackendUrl("dev", { PROUD_FLOW_API_URL: "http://localhost:9999" }),
      "http://localhost:9999",
    );
  });

  it("initializes local config, stores tokens outside stdout, and reports auth status", async () => {
    const runtime = createMemoryCliRuntime({
      fetch: createMockFetch((url) => {
        assert.equal(url, "http://127.0.0.1:8787/api/local/bootstrap");
        return {
          status: 201,
          body: {
            tokens: {
              skill: "pf_skill_secret",
              dispatcher: "pf_dispatcher_secret",
              local: "pf_local_secret",
            },
          },
        };
      }),
    });

    const init = await runCli(
      [
        "init",
        "--env",
        "dev",
        "--bootstrap-token",
        "boot",
        "--machine-name",
        "mac",
      ],
      runtime,
    );
    assert.equal(init.exitCode, 0);
    assert.match(init.stdout, /Initialized Proud Flow CLI/);
    assert.equal(init.stdout.includes("pf_skill_secret"), false);

    assert.equal(await runtime.keychain.getToken("skill"), "pf_skill_secret");
    assert.deepEqual(await runtime.store.readConfig(), {
      environment: "dev",
      machineName: "mac",
      workspacePath: process.cwd(),
    });

    const status = await runCli(["auth", "status", "--json"], runtime);
    assert.equal(JSON.parse(status.stdout).authenticated, true);
  });

  it("rotates and revokes auth tokens through the Local API", async () => {
    const runtime = createMemoryCliRuntime({
      fetch: createMockFetch((url, init) => {
        if (url.endsWith("/tokens/rotate")) {
          assert.equal(init.headers.Authorization, "Bearer pf_local_old");
          return { body: { token: "pf_skill_new" } };
        }
        if (url.endsWith("/tokens/revoke")) return { body: {} };
        throw new Error(`unexpected ${url}`);
      }),
    });
    await runtime.store.writeConfig({
      environment: "dev",
      machineName: "mac",
      workspacePath: process.cwd(),
    });
    await runtime.keychain.setToken("local", "pf_local_old");
    await runtime.keychain.setToken("skill", "pf_skill_old");

    const rotated = await runCli(["auth", "rotate", "--type", "skill"], runtime);
    assert.equal(rotated.exitCode, 0);
    assert.equal(await runtime.keychain.getToken("skill"), "pf_skill_new");
    assert.equal(rotated.stdout.includes("pf_skill_new"), false);

    const logout = await runCli(["auth", "logout"], runtime);
    assert.equal(logout.exitCode, 0);
    assert.equal(await runtime.keychain.getToken("skill"), undefined);
    assert.equal(await runtime.keychain.getToken("local"), undefined);
  });

  it("calls Skills API helper commands and supports JSON or Markdown output", async () => {
    const requirement = {
      id: "REQ-000123",
      title: "需求",
      description: "描述",
      status: "tech-design",
      priority: "high",
      version: 1,
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    };
    const runtime = createMemoryCliRuntime({
      fetch: createMockFetch((url, init) => {
        assert.equal(init.headers.Authorization, "Bearer pf_skill_token");
        if (url.endsWith("/task-context")) {
          return {
            body: {
              requirement,
              currentArtifacts: { items: [] },
              historicalArtifacts: { items: [] },
              requiredArtifactTypes: ["tech_design_pr"],
              allowedActions: ["complete-stage"],
            },
          };
        }
        if (url.endsWith("/artifacts/upload")) {
          return { status: 201, body: { id: "art_1", requirementId: "REQ-000123", requirementVersion: 1, type: "screenshot", title: "截图", createdAt: "now" } };
        }
        if (url.endsWith("/artifacts")) {
          return { status: 201, body: { id: "art_1", requirementId: "REQ-000123", requirementVersion: 1, type: "tech_design_pr", title: "PR", createdAt: "now" } };
        }
        if (url.endsWith("/complete-stage") || url.endsWith("/fail-stage") || url.endsWith("/status/start")) {
          return { body: { requirement } };
        }
        if (url.endsWith("/notes")) {
          return { body: { requirement } };
        }
        return { body: requirement };
      }),
      files: new Map([["/tmp/screen.png", Buffer.from("screen")]]),
    });
    await runtime.store.writeConfig({
      environment: "dev",
      machineName: "mac",
      workspacePath: process.cwd(),
    });
    await runtime.keychain.setToken("skill", "pf_skill_token");

    const context = await runCli(
      ["get-task-context", "REQ-000123", "--stage", "tech_design"],
      runtime,
    );
    assert.match(context.stdout, /# Task Context/);
    assert.match(context.stdout, /REQ-000123/);

    const json = await runCli(["get-requirement", "REQ-000123", "--json"], runtime);
    assert.equal(JSON.parse(json.stdout).id, "REQ-000123");

    assert.equal((await runCli(["start-stage", "REQ-000123", "--stage", "tech_design"], runtime)).exitCode, 0);
    assert.equal((await runCli(["attach-artifact", "REQ-000123", "--type", "tech_design_pr", "--title", "PR", "--url", "https://pr"], runtime)).exitCode, 0);
    assert.equal((await runCli(["upload-artifact", "REQ-000123", "--type", "screenshot", "--title", "截图", "--file", "/tmp/screen.png"], runtime)).exitCode, 0);
    assert.equal((await runCli(["complete-stage", "REQ-000123", "--stage", "tech_design", "--summary", "done"], runtime)).exitCode, 0);
    assert.equal((await runCli(["fail-stage", "REQ-000123", "--stage", "development", "--message", "fail"], runtime)).exitCode, 0);
    assert.equal((await runCli(["append-note", "REQ-000123", "--message", "note"], runtime)).exitCode, 0);
  });

  it("returns stable error codes for API errors", async () => {
    const runtime = createMemoryCliRuntime({
      fetch: createMockFetch(() => ({
        status: 409,
        body: { error: { code: "INVALID_STATUS_TRANSITION", message: "bad" } },
      })),
    });
    await runtime.store.writeConfig({ environment: "dev", workspacePath: process.cwd() });
    await runtime.keychain.setToken("skill", "pf_skill_token");

    const result = await runCli(
      ["complete-stage", "REQ-000123", "--stage", "tech_design", "--json"],
      runtime,
    );
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(result.stderr).error.code, "INVALID_STATUS_TRANSITION");
  });

  it("covers default markdown status, invalid flags, and logout without local token", async () => {
    const runtime = createMemoryCliRuntime({
      fetch: createMockFetch(() => ({
        status: 201,
        body: {
          tokens: {
            skill: "pf_skill_default",
            dispatcher: "pf_dispatcher_default",
            local: "pf_local_default",
          },
        },
      })),
    });

    const invalidEnv = await runCli(
      ["init", "--env", "qa", "--bootstrap-token", "boot"],
      runtime,
    );
    assert.equal(invalidEnv.exitCode, 1);
    assert.match(invalidEnv.stderr, /INTERNAL_ERROR/);

    const initialized = await runCli(["init", "--bootstrap-token", "boot"], runtime);
    assert.match(initialized.stdout, /prod/);

    const status = await runCli(["status"], runtime);
    assert.match(status.stdout, /Proud Flow CLI/);
    assert.match(status.stdout, /Authenticated: yes/);

    const authStatus = await runCli(["auth", "status"], runtime);
    assert.match(authStatus.stdout, /Authenticated: yes/);

    const badRotate = await runCli(["auth", "rotate", "--type", "user"], runtime);
    assert.equal(badRotate.exitCode, 1);

    await runtime.keychain.deleteToken("local");
    const logout = await runCli(["auth", "logout"], runtime);
    assert.equal(logout.exitCode, 0);
  });

  it("reports missing initialization and unknown helper commands", async () => {
    const runtime = createMemoryCliRuntime();

    const missingConfig = await runCli(["status", "--json"], runtime);
    assert.equal(missingConfig.exitCode, 1);
    assert.equal(JSON.parse(missingConfig.stderr).error.code, "INTERNAL_ERROR");

    await runtime.store.writeConfig({ environment: "dev", workspacePath: process.cwd() });
    await runtime.keychain.setToken("skill", "pf_skill_token");
    const unknown = await runCli(["unknown", "REQ-000123"], runtime);
    assert.equal(unknown.exitCode, 1);
  });
});
