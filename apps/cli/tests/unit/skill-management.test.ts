// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createMemoryCliRuntime, runCli } from "../../src/index";

const skillInstallPath = "/workspace/.codex/skills/tech-design/SKILL.md";

describe("CLI Skill management commands", () => {
  it("fails install when CLI is not initialized", async () => {
    const runtime = createMemoryCliRuntime();
    const result = await runCli(["skill", "install"], runtime);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /not initialized/i);
  });

  it("installs bundled skills into workspacePath/.codex/skills", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });

    const result = await runCli(["skill", "install", "--json"], runtime);

    assert.equal(result.exitCode, 0);
    const body = JSON.parse(result.stdout);
    assert.equal(body.skillInstallRoot, "/workspace/.codex/skills");
    assert.equal(body.installed.length, 3);
    assert.match(
      Buffer.from(await runtime.readFile(skillInstallPath)).toString("utf8"),
      /get-task-context/,
    );
  });

  it("installs to config workspacePath even when cwd differs", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/other-workspace",
    });

    const result = await runCli(["skill", "install", "--json"], runtime);
    assert.equal(result.exitCode, 0);
    assert.ok(
      await runtime.readFile("/other-workspace/.codex/skills/tech-design/SKILL.md"),
    );
    await assert.rejects(() => runtime.readFile(skillInstallPath));
  });

  it("reports installed and locally modified skills", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });

    await runCli(["skill", "install"], runtime);
    const installed = await runCli(["skill", "status", "--json"], runtime);
    const installedBody = JSON.parse(installed.stdout);
    assert.equal(
      installedBody.skills.find((skill) => skill.name === "tech-design")?.status,
      "installed",
    );

    await runtime.writeFile(skillInstallPath, Buffer.from("# Modified\n"));
    const modified = await runCli(["skill", "status", "--json"], runtime);
    assert.equal(
      JSON.parse(modified.stdout).skills.find((skill) => skill.name === "tech-design")
        ?.status,
      "modified",
    );
  });

  it("skips modified skills on update unless force is passed", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });

    await runCli(["skill", "install"], runtime);
    await runtime.writeFile(skillInstallPath, Buffer.from("# Modified\n"));

    const skipped = await runCli(["skill", "update", "--json"], runtime);
    assert.equal(JSON.parse(skipped.stdout).skipped[0].reason, "modified");

    const forced = await runCli(["skill", "update", "--force", "--json"], runtime);
    assert.ok(
      JSON.parse(forced.stdout).installed.some((item) => item.name === "tech-design"),
    );
  });
});
