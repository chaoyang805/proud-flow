// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createMemoryCliRuntime, runCli } from "../../src/index";
import { createMockFetch } from "./cli-test-utils";

describe("CLI init and status", () => {
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
    assert.match(init.stdout, /\.codex\/skills/);
    assert.equal(init.stdout.includes("pf_skill_secret"), false);

    const workspacePath = process.cwd();
    assert.match(
      Buffer.from(
        await runtime.readFile(
          `${workspacePath}/.codex/skills/tech-design/SKILL.md`,
        ),
      ).toString("utf8"),
      /get-task-context/,
    );

    assert.equal(await runtime.keychain.getToken("skill"), "pf_skill_secret");
    assert.deepEqual(await runtime.store.readConfig(), {
      environment: "dev",
      machineName: "mac",
      workspacePath: process.cwd(),
    });

    const status = await runCli(["auth", "status", "--json"], runtime);
    assert.equal(JSON.parse(status.stdout).authenticated, true);
  });

  it("covers default markdown status and invalid init flags", async () => {
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
  });

  it("does not install skills when bootstrap fails", async () => {
    const runtime = createMemoryCliRuntime({
      fetch: createMockFetch(() => ({
        status: 401,
        body: { error: { code: "FORBIDDEN", message: "invalid bootstrap" } },
      })),
    });

    const init = await runCli(
      ["init", "--env", "dev", "--bootstrap-token", "bad", "--machine-name", "mac"],
      runtime,
    );
    assert.equal(init.exitCode, 1);
    await assert.rejects(() =>
      runtime.readFile(`${process.cwd()}/.codex/skills/tech-design/SKILL.md`),
    );
  });

  it("reports missing initialization", async () => {
    const runtime = createMemoryCliRuntime();

    const missingConfig = await runCli(["status", "--json"], runtime);
    assert.equal(missingConfig.exitCode, 1);
    assert.equal(JSON.parse(missingConfig.stderr).error.code, "INTERNAL_ERROR");
  });

  it("shows help on stderr when a command group is used without a subcommand", async () => {
    const runtime = createMemoryCliRuntime();
    const result = await runCli(["auth"], runtime);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /auth/);
    assert.match(result.stderr, /status/);
    assert.equal(result.stdout, "");
  });

  it("shows help for auth --help", async () => {
    const runtime = createMemoryCliRuntime();
    const result = await runCli(["auth", "--help"], runtime);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /rotate/);
  });

  it("shows help without requiring a requirement id", async () => {
    const runtime = createMemoryCliRuntime();

    for (const args of [["--help"], ["-h"], []] as const) {
      const result = await runCli(args, runtime);
      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Proud Flow CLI/);
      assert.match(result.stdout, /init \[options\]/);
    }
  });
});
