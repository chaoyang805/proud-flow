import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CliConfig } from "../runtime";

export interface BundledSkillManifestEntry {
  name: string;
  version: string;
  files: Record<string, string>;
}

export interface BundledSkillManifest {
  version: string;
  cliVersionRange: string;
  skills: BundledSkillManifestEntry[];
}

export function resolveSkillInstallRoot(config: CliConfig): string {
  return `${config.workspacePath}/.codex/skills`;
}

export function getPackageSkillsRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "../package-skills"),
    join(moduleDir, "../../dist/package-skills"),
  ];
  for (const root of candidates) {
    if (existsSync(join(root, "manifest.json"))) {
      return root;
    }
  }
  throw new Error(
    "SKILL_MANIFEST_NOT_FOUND: run pnpm --filter @proud-flow/cli skills:bundle or build",
  );
}

export function loadBundledManifest(
  packageSkillsRoot: string = getPackageSkillsRoot(),
): BundledSkillManifest {
  const raw = readFileSync(join(packageSkillsRoot, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw) as BundledSkillManifest;
  if (!manifest.version || !Array.isArray(manifest.skills)) {
    throw new Error("SKILL_MANIFEST_INVALID");
  }
  for (const entry of manifest.skills) {
    if (!entry.name || !entry.version || !entry.files) {
      throw new Error("SKILL_MANIFEST_INVALID");
    }
  }
  return manifest;
}
