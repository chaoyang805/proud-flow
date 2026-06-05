import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "vitest";
import { createNodeCliRuntime } from "../../src/index";

describe("Node CLI runtime", () => {
  it("persists config and tokens under the configured Proud Flow directory", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "proud-flow-cli-"));
    try {
      const runtime = createNodeCliRuntime({
        configDir,
        env: { PROUD_FLOW_API_URL: "https://api.test" },
        cwd: "/workspace",
      });

      await runtime.store.writeConfig({
        environment: "prod",
        machineName: "laptop",
        workspacePath: "/workspace",
      });
      await runtime.keychain.setToken("skill", "pf_skill_token");

      assert.deepEqual(await runtime.store.readConfig(), {
        environment: "prod",
        machineName: "laptop",
        workspacePath: "/workspace",
      });
      assert.equal(await runtime.keychain.getToken("skill"), "pf_skill_token");
      assert.match(await readFile(join(configDir, "tokens.json"), "utf8"), /pf_skill_token/);

      await runtime.keychain.deleteToken("skill");
      await runtime.store.clearConfig();

      assert.equal(await runtime.keychain.getToken("skill"), undefined);
      assert.equal(await runtime.store.readConfig(), undefined);
    } finally {
      await rm(configDir, { recursive: true, force: true });
    }
  });
});
