import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, beforeEach, afterEach } from "vitest";
import { createNodeCliRuntime } from "../../src/index";

describe("Node CLI runtime", () => {
  let configDir: string;

  beforeEach(async () => {
    configDir = await mkdtemp(join(tmpdir(), "proud-flow-cli-"));
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  it("persists config and tokens under the configured Proud Flow directory", async () => {
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
  });

  it("reads config returns undefined when file does not exist", async () => {
    const runtime = createNodeCliRuntime({
      configDir: join(tmpdir(), "nonexistent-" + Date.now()),
    });
    const config = await runtime.store.readConfig();
    assert.equal(config, undefined);
  });

  it("sets and reads multiple token types independently", async () => {
    const runtime = createNodeCliRuntime({ configDir });

    await runtime.keychain.setToken("skill", "token-skill");
    await runtime.keychain.setToken("dispatcher", "token-dispatch");
    await runtime.keychain.setToken("local", "token-local");

    assert.equal(await runtime.keychain.getToken("skill"), "token-skill");
    assert.equal(await runtime.keychain.getToken("dispatcher"), "token-dispatch");
    assert.equal(await runtime.keychain.getToken("local"), "token-local");

    await runtime.keychain.deleteToken("dispatcher");
    assert.equal(await runtime.keychain.getToken("dispatcher"), undefined);
    assert.equal(await runtime.keychain.getToken("skill"), "token-skill");
  });

  it("reads and writes files via runtime", async () => {
    const runtime = createNodeCliRuntime({ configDir });
    const testPath = join(configDir, "test-file.txt");
    const content = new TextEncoder().encode("hello world");

    await runtime.writeFile(testPath, content);
    const read = await runtime.readFile(testPath);
    assert.equal(new TextDecoder().decode(read), "hello world");
  });

  it("listFiles returns files recursively", async () => {
    const runtime = createNodeCliRuntime({ configDir });
    const subDir = join(configDir, "sub");
    await mkdir(subDir, { recursive: true });
    await writeFile(join(configDir, "a.txt"), "a");
    await writeFile(join(subDir, "b.txt"), "b");

    const files = await runtime.listFiles(configDir);
    assert.ok(files.some((f: string) => f.endsWith("a.txt")));
    assert.ok(files.some((f: string) => f.endsWith("b.txt")));
  });

  it("store clearConfig removes config file", async () => {
    const runtime = createNodeCliRuntime({ configDir });
    await runtime.store.writeConfig({
      environment: "dev",
      workspacePath: "/test",
    });
    assert.ok(await runtime.store.readConfig());
    await runtime.store.clearConfig();
    assert.equal(await runtime.store.readConfig(), undefined);
  });

  it("keychain getToken returns undefined for missing token", async () => {
    const runtime = createNodeCliRuntime({ configDir });
    assert.equal(await runtime.keychain.getToken("skill"), undefined);
  });
});
