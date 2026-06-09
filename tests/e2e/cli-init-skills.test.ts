// @ts-nocheck
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "vitest";
import { createApiApp, hashToken } from "../../apps/api/src/test-utils";
import { createMemoryCliRuntime, runCli } from "../../apps/cli/src/index";
describe("CLI init and bundled skills e2e", () => {
  it("installs skills to workspacePath when it differs from cwd", async () => {
    const app = createApiApp();
    const bootstrapHash = await hashToken("init-skills-bootstrap", "pepper");
    const env = {
      BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
      TOKEN_HASH_SECRET: "pepper",
    };
    const workspacePath = "/project-root";
    const runtime = createMemoryCliRuntime({
      fetch: (url, init) =>
        app.fetch(
          new Request(String(url), {
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
        "init-skills-bootstrap",
        "--machine-name",
        "e2e-init",
        "--json",
      ],
      runtime,
    );
    assert.equal(init.exitCode, 0);
    const body = JSON.parse(init.stdout);
    assert.equal(body.skillInstallRoot, `${process.cwd()}/.codex/skills`);
    assert.equal(body.skillsInstalled.length, 3);

    await runtime.store.writeConfig({
      environment: "dev",
      machineName: "e2e-init",
      workspacePath,
    });
    const install = await runCli(["skill", "install", "--json"], runtime);
    assert.equal(install.exitCode, 0);
    assert.equal(JSON.parse(install.stdout).skillInstallRoot, `${workspacePath}/.codex/skills`);
    assert.ok(
      await runtime.readFile(`${workspacePath}/.codex/skills/tech-design/SKILL.md`),
    );
  });

  it("keeps skill install idempotent", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });

    const first = await runCli(["skill", "install", "--json"], runtime);
    const firstRecord = await runtime.readFile(
      "/workspace/.codex/skills/tech-design/.proud-flow-install.json",
    );
    const second = await runCli(["skill", "install", "--json"], runtime);
    const secondRecord = await runtime.readFile(
      "/workspace/.codex/skills/tech-design/.proud-flow-install.json",
    );

    assert.equal(first.exitCode, 0);
    assert.equal(second.exitCode, 0);
    assert.deepEqual(firstRecord, secondRecord);
    const status = await runCli(["skill", "status", "--json"], runtime);
    assert.deepEqual(
      JSON.parse(status.stdout).skills.map((skill) => skill.status),
      ["installed", "installed", "installed"],
    );
  });

  it("updates install record after force reinstall", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });
    await runCli(["skill", "install"], runtime);
    await runtime.writeFile(
      "/workspace/.codex/skills/tech-design/SKILL.md",
      Buffer.from("# Modified\n"),
    );

    const forced = await runCli(["skill", "install", "--force", "--json"], runtime);
    assert.equal(forced.exitCode, 0);
    const record = JSON.parse(
      Buffer.from(
        await runtime.readFile(
          "/workspace/.codex/skills/tech-design/.proud-flow-install.json",
        ),
      ).toString("utf8"),
    );
    const skillMd = await runtime.readFile(
      "/workspace/.codex/skills/tech-design/SKILL.md",
    );
    assert.equal(
      createHash("sha256").update(skillMd).digest("hex"),
      record.files["SKILL.md"],
    );
  });
});
