// @ts-nocheck
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "vitest";
import { createMemoryCliRuntime, runCli } from "../../src/index";
import { createMockFetch } from "./cli-test-utils";

const skillPackage = {
  name: "tech-design",
  version: "0.1.0",
  files: [
    {
      path: "SKILL.md",
      content:
        "# Tech Design\n\nRun `proud-flow get-task-context REQ-000123 --stage tech_design`.\n",
    },
    {
      path: "skill.json",
      content: "{\"name\":\"tech-design\",\"version\":\"0.1.0\"}\n",
    },
  ],
};

const packageBytes = Buffer.from(JSON.stringify(skillPackage));
const packageSha = createHash("sha256").update(packageBytes).digest("hex");

function createSkillRuntime(packageOverride = packageBytes) {
  const runtime = createMemoryCliRuntime({
    env: {
      PROUD_FLOW_API_URL: "https://api.local",
      CODEX_HOME: "/codex",
    },
    fetch: createMockFetch((url, init) => {
      if (url === "https://api.local/api/local/skills/manifest") {
        assert.equal(init.headers.Authorization, "Bearer pf_local_token");
        return {
          body: {
            version: "0.1.0",
            cliVersionRange: ">=0.1.0",
            skills: [
              {
                name: "tech-design",
                version: "0.1.0",
                downloadUrl: "https://static.local/tech-design.skillpkg.json",
                sha256: packageSha,
              },
            ],
          },
        };
      }
      if (url === "https://static.local/tech-design.skillpkg.json") {
        return { rawBody: packageOverride };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }),
  });
  return runtime;
}

describe("CLI Skill management commands", () => {
  it("installs Skills from the local manifest and verifies package sha256", async () => {
    const runtime = createSkillRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });
    await runtime.keychain.setToken("local", "pf_local_token");

    const result = await runCli(["skill", "install", "--json"], runtime);

    assert.equal(result.exitCode, 0);
    assert.equal(JSON.parse(result.stdout).installed[0].name, "tech-design");
    assert.match(
      Buffer.from(
        await runtime.readFile("/codex/skills/tech-design/SKILL.md"),
      ).toString("utf8"),
      /get-task-context/,
    );
  });

  it("reports installed and locally modified Skills", async () => {
    const runtime = createSkillRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });
    await runtime.keychain.setToken("local", "pf_local_token");

    await runCli(["skill", "install"], runtime);
    const installed = await runCli(["skill", "status", "--json"], runtime);
    assert.equal(JSON.parse(installed.stdout).skills[0].status, "installed");

    await runtime.writeFile(
      "/codex/skills/tech-design/SKILL.md",
      Buffer.from("# Modified\n"),
    );
    const modified = await runCli(["skill", "status", "--json"], runtime);
    assert.equal(JSON.parse(modified.stdout).skills[0].status, "modified");
  });

  it("skips modified Skills on update unless force is passed", async () => {
    const runtime = createSkillRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });
    await runtime.keychain.setToken("local", "pf_local_token");

    await runCli(["skill", "install"], runtime);
    await runtime.writeFile(
      "/codex/skills/tech-design/SKILL.md",
      Buffer.from("# Modified\n"),
    );

    const skipped = await runCli(["skill", "update", "--json"], runtime);
    assert.equal(JSON.parse(skipped.stdout).skipped[0].reason, "modified");

    const forced = await runCli(["skill", "update", "--force", "--json"], runtime);
    assert.equal(JSON.parse(forced.stdout).installed[0].name, "tech-design");
  });

  it("fails install when package hash does not match the manifest", async () => {
    const runtime = createSkillRuntime(Buffer.from("tampered"));
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/workspace",
    });
    await runtime.keychain.setToken("local", "pf_local_token");

    const result = await runCli(["skill", "install"], runtime);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /SKILL_PACKAGE_HASH_MISMATCH/);
  });
});
