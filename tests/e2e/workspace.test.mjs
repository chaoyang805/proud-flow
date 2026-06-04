import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
      "node scripts/turbo-run.mjs typecheck",
    );
    assert.equal(packageJson.scripts.lint, "node scripts/lint.mjs");
    assert.equal(packageJson.scripts.test, "node scripts/turbo-run.mjs test");
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
    const { createApiApp } = await import("../../apps/api/dist/index.js");
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
});
