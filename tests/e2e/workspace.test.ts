// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

describe("workspace e2e", () => {
  it("exposes the required root quality commands", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    );

    assert.equal(
      packageJson.scripts.typecheck,
      "pnpm build && node scripts/turbo-run.mjs typecheck",
    );
    assert.equal(packageJson.scripts.lint, "node scripts/lint.mjs");
    assert.equal(
      packageJson.scripts.test,
      "pnpm build && node scripts/turbo-run.mjs test",
    );
    assert.equal(packageJson.scripts.build, "node scripts/turbo-run.mjs build");
  });

  it("includes every planned app, package, and skill", async () => {
    const workspace = await readFile(
      path.join(root, "pnpm-workspace.yaml"),
      "utf8",
    );

    assert.match(workspace, /apps\/\*/);
    assert.match(workspace, /packages\/\*/);
    assert.match(workspace, /skills\/\*/);
  });

  it("generates OpenAPI JSON for shared API contracts", async () => {
    const openapi = JSON.parse(
      await readFile(
        path.join(root, "packages/api-contract/generated/openapi.json"),
        "utf8",
      ),
    );

    assert.equal(openapi.openapi, "3.1.0");
    assert.ok(openapi.paths["/api/requirements"]);
    assert.ok(openapi.paths["/api/local/skills/manifest"]);
  });
  it("runs a P2 backend requirement lifecycle through the Worker fetch app", async () => {
    const { createApiApp } = await import("../../apps/api/src/index");
    const app = createApiApp();

    const created = await app.fetch(
      new Request("https://api.test/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "E2E",
          description: "P2",
          priority: "high",
        }),
      }),
    );
    const requirement = await created.json();
    assert.equal(requirement.status, "planning");

    await app.fetch(
      new Request(
        `https://api.test/api/requirements/${requirement.id}/workflow/start-stage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "tech_design" }),
        },
      ),
    );
    await app.fetch(
      new Request(
        `https://api.test/api/requirements/${requirement.id}/artifacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "tech_design_pr", title: "PR" }),
        },
      ),
    );
    const completed = await app.fetch(
      new Request(
        `https://api.test/api/requirements/${requirement.id}/workflow/complete-stage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "tech_design" }),
        },
      ),
    );
    const completedBody = await completed.json();

    assert.equal(completedBody.requirement.status, "tech-review");
  });

  it("runs a P3 local bootstrap and Skills API lifecycle through the Worker fetch app", async () => {
    const { createApiApp, hashToken } = await import(
      "../../apps/api/src/index"
    );
    const app = createApiApp();
    const bootstrapHash = await hashToken("bootstrap-e2e", "pepper");
    const env = {
      BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
      TOKEN_HASH_SECRET: "pepper",
    };

    const bootstrapped = await app.fetch(
      new Request("https://api.test/api/local/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bootstrapToken: "bootstrap-e2e",
          machineName: "e2e-host",
        }),
      }),
      env,
    );
    assert.equal(bootstrapped.status, 201);
    const bootstrapBody = await bootstrapped.json();
    assert.match(bootstrapBody.tokens.skill, /^pf_skill_/);
    assert.match(bootstrapBody.tokens.dispatcher, /^pf_dispatcher_/);
    assert.match(bootstrapBody.tokens.local, /^pf_local_/);

    const created = await app.fetch(
      new Request("https://api.test/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "P3 E2E",
          description: "Skills API",
          priority: "high",
        }),
      }),
      env,
    );
    const requirement = await created.json();

    const skillHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bootstrapBody.tokens.skill}`,
    };
    await app.fetch(
      new Request(
        `https://api.test/api/skills/requirements/${requirement.id}/status/start`,
        {
          method: "POST",
          headers: skillHeaders,
          body: JSON.stringify({ stage: "tech_design" }),
        },
      ),
      env,
    );
    await app.fetch(
      new Request(
        `https://api.test/api/skills/requirements/${requirement.id}/artifacts`,
        {
          method: "POST",
          headers: skillHeaders,
          body: JSON.stringify({ type: "tech_design_pr", title: "PR" }),
        },
      ),
      env,
    );
    const completed = await app.fetch(
      new Request(
        `https://api.test/api/skills/requirements/${requirement.id}/complete-stage`,
        {
          method: "POST",
          headers: skillHeaders,
          body: JSON.stringify({ stage: "tech_design" }),
        },
      ),
      env,
    );
    const completedBody = await completed.json();
    assert.equal(completedBody.requirement.status, "tech-review");

    const forbidden = await app.fetch(
      new Request(`https://api.test/api/requirements/${requirement.id}`, {
        headers: { Authorization: `Bearer ${bootstrapBody.tokens.skill}` },
      }),
      env,
    );
    const forbiddenBody = await forbidden.json();
    assert.equal(forbiddenBody.error.code, "FORBIDDEN");
  });

  it("runs P4 CLI helper against the local dev API", async () => {
    const { createApiApp, hashToken } = await import(
      "../../apps/api/src/index"
    );
    const { createMemoryCliRuntime, runCli } = await import(
      "../../apps/cli/src/index"
    );
    const app = createApiApp();
    const bootstrapHash = await hashToken("cli-bootstrap", "pepper");
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
        "cli-bootstrap",
        "--machine-name",
        "e2e",
      ],
      runtime,
    );
    assert.equal(init.exitCode, 0);

    await app.fetch(
      new Request("https://api.test/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "CLI E2E",
          description: "helper",
          priority: "high",
        }),
      }),
      env,
    );

    const started = await runCli(
      ["start-stage", "REQ-000001", "--stage", "tech_design", "--json"],
      runtime,
    );
    assert.equal(JSON.parse(started.stdout).requirement.status, "tech-design");

    await runCli(
      [
        "attach-artifact",
        "REQ-000001",
        "--type",
        "tech_design_pr",
        "--title",
        "PR",
      ],
      runtime,
    );
    const completed = await runCli(
      ["complete-stage", "REQ-000001", "--stage", "tech_design", "--json"],
      runtime,
    );
    assert.equal(JSON.parse(completed.stdout).requirement.status, "tech-review");
  });
});
