// @ts-nocheck
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { describe, it } from "vitest";
import { createMemoryCliRuntime, runCli } from "../../src/index";
import { createMockFetch, requirementFixture } from "./cli-test-utils";

describe("CLI Skills API helper commands", () => {
  it("calls Skills API helper commands and supports JSON or Markdown output", async () => {
    const runtime = createMemoryCliRuntime({
      fetch: createMockFetch((url, init) => {
        assert.equal(init.headers.Authorization, "Bearer pf_skill_token");
        if (url.endsWith("/task-context")) {
          return {
            body: {
              requirement: requirementFixture,
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
          return { body: { requirement: requirementFixture } };
        }
        if (url.endsWith("/notes")) {
          return { body: { requirement: requirementFixture } };
        }
        return { body: requirementFixture };
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

  it("reports unknown helper commands", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({ environment: "dev", workspacePath: process.cwd() });
    await runtime.keychain.setToken("skill", "pf_skill_token");

    const unknown = await runCli(["unknown", "REQ-000123"], runtime);
    assert.equal(unknown.exitCode, 1);
  });
});
