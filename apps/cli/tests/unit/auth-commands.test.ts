// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createMemoryCliRuntime, runCli } from "../../src/index";
import { createMockFetch } from "./cli-test-utils";

describe("CLI auth commands", () => {
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

  it("handles invalid rotate type and logout without local token", async () => {
    const runtime = createMemoryCliRuntime();
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: process.cwd(),
    });

    const badRotate = await runCli(["auth", "rotate", "--type", "user"], runtime);
    assert.equal(badRotate.exitCode, 1);

    const logout = await runCli(["auth", "logout"], runtime);
    assert.equal(logout.exitCode, 0);
  });
});
