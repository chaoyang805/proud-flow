// @ts-nocheck
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { generateSkillsManifest } from "../../scripts/bundle-skills.mjs";

describe("bundle-skills manifest", () => {
  it("builds manifest with file hashes from skill sources", async () => {
    const root = mkdtempSync(join(tmpdir(), "pf-skill-manifest-"));
    try {
      const skillDir = join(root, "tech-design");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "skill.json"),
        '{"name":"tech-design","version":"0.2.0"}\n',
      );
      writeFileSync(join(skillDir, "SKILL.md"), "# Tech Design\n");

      const outputPath = join(root, "manifest.json");
      const manifest = await generateSkillsManifest({
        skillsRoot: root,
        outputPath,
        cliVersion: "0.2.0",
      });

      assert.equal(manifest.version, "0.2.0");
      assert.equal(manifest.skills.length, 1);
      assert.equal(manifest.skills[0].version, "0.2.0");
      assert.ok(manifest.skills[0].files["SKILL.md"]);
      assert.deepEqual(
        JSON.parse(readFileSync(outputPath, "utf8")),
        manifest,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
