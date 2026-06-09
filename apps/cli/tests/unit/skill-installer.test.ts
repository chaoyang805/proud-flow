// @ts-nocheck
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { createMemoryCliRuntime } from "../../src/index";
import {
  getPackageSkillsRoot,
  loadBundledManifest,
  resolveSkillInstallRoot,
} from "../../src/skills/bundled-manifest";
import {
  getSkillStatuses,
  installSkills,
} from "../../src/skills/installer";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("skill installer", () => {
  const packageSkillsRoot = getPackageSkillsRoot();
  const manifest = loadBundledManifest(packageSkillsRoot);

  it("resolves install root from workspacePath", () => {
    assert.equal(
      resolveSkillInstallRoot({ environment: "dev", workspacePath: "/proj" }),
      "/proj/.codex/skills",
    );
  });

  it("loads bundled manifest with three skills and valid sha256 hashes", () => {
    assert.equal(manifest.version, "0.1.0");
    assert.equal(manifest.skills.length, 3);
    for (const entry of manifest.skills) {
      for (const hash of Object.values(entry.files)) {
        assert.match(hash, /^[a-f0-9]{64}$/);
      }
    }
  });

  it("installs skills into workspacePath/.codex/skills", async () => {
    const runtime = createMemoryCliRuntime();
    const config = { environment: "dev", workspacePath: "/workspace" };
    const result = await installSkills(runtime, manifest, {
      config,
      packageSkillsRoot,
    });

    assert.equal(result.installed.length, 3);
    assert.equal(result.skipped.length, 0);
    const skillMd = Buffer.from(
      await runtime.readFile("/workspace/.codex/skills/tech-design/SKILL.md"),
    ).toString("utf8");
    assert.match(skillMd, /get-task-context/);
    const record = JSON.parse(
      Buffer.from(
        await runtime.readFile(
          "/workspace/.codex/skills/tech-design/.proud-flow-install.json",
        ),
      ).toString("utf8"),
    );
    assert.equal(record.version, "0.1.0");
    assert.equal(record.name, "tech-design");
  });

  it("reports installed status after install", async () => {
    const runtime = createMemoryCliRuntime();
    const config = { environment: "dev", workspacePath: "/workspace" };
    await installSkills(runtime, manifest, { config, packageSkillsRoot });
    const statuses = await getSkillStatuses(runtime, manifest, config);
    assert.deepEqual(
      statuses.map((item) => item.status),
      ["installed", "installed", "installed"],
    );
  });

  it("detects locally modified skills", async () => {
    const runtime = createMemoryCliRuntime();
    const config = { environment: "dev", workspacePath: "/workspace" };
    await installSkills(runtime, manifest, { config, packageSkillsRoot });
    await runtime.writeFile(
      "/workspace/.codex/skills/tech-design/SKILL.md",
      Buffer.from("# Modified\n"),
    );
    const statuses = await getSkillStatuses(runtime, manifest, config);
    assert.equal(
      statuses.find((item) => item.name === "tech-design")?.status,
      "modified",
    );
  });

  it("skips modified skills on update unless force is passed", async () => {
    const runtime = createMemoryCliRuntime();
    const config = { environment: "dev", workspacePath: "/workspace" };
    await installSkills(runtime, manifest, { config, packageSkillsRoot });
    await runtime.writeFile(
      "/workspace/.codex/skills/tech-design/SKILL.md",
      Buffer.from("# Modified\n"),
    );

    const skipped = await installSkills(runtime, manifest, {
      config,
      packageSkillsRoot,
    });
    assert.deepEqual(skipped.skipped, [{ name: "tech-design", reason: "modified" }]);

    const forced = await installSkills(runtime, manifest, {
      config,
      packageSkillsRoot,
      force: true,
    });
    assert.ok(forced.installed.some((item) => item.name === "tech-design"));
    const statuses = await getSkillStatuses(runtime, manifest, config);
    assert.equal(
      statuses.find((item) => item.name === "tech-design")?.status,
      "installed",
    );
  });

  it("throws when bundled package file is missing", async () => {
    const runtime = createMemoryCliRuntime();
    const config = { environment: "dev", workspacePath: "/workspace" };
    const tempRoot = mkdtempSync(join(tmpdir(), "pf-skill-missing-"));
    try {
      const brokenManifest = {
        ...manifest,
        skills: [
          {
            name: "tech-design",
            version: "0.1.0",
            files: { "missing.md": sha256("x") },
          },
        ],
      };
      mkdirSync(join(tempRoot, "tech-design"), { recursive: true });
      await assert.rejects(
        () =>
          installSkills(runtime, brokenManifest, {
            config,
            packageSkillsRoot: tempRoot,
          }),
        /SKILL_PACKAGE_FILE_MISSING/,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("throws when bundled file hash does not match manifest", async () => {
    const runtime = createMemoryCliRuntime();
    const config = { environment: "dev", workspacePath: "/workspace" };
    const tempRoot = mkdtempSync(join(tmpdir(), "pf-skill-hash-"));
    try {
      const content = "# Broken\n";
      mkdirSync(join(tempRoot, "tech-design"), { recursive: true });
      writeFileSync(join(tempRoot, "tech-design", "SKILL.md"), content);
      const brokenManifest = {
        ...manifest,
        skills: [
          {
            name: "tech-design",
            version: "0.1.0",
            files: { "SKILL.md": sha256("wrong") },
          },
        ],
      };
      await assert.rejects(
        () =>
          installSkills(runtime, brokenManifest, {
            config,
            packageSkillsRoot: tempRoot,
          }),
        /SKILL_PACKAGE_HASH_MISMATCH/,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
