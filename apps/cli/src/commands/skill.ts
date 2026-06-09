import type { CliRuntime } from "../runtime";
import { requireConfig } from "../cli/clients";
import {
  getSkillStatuses,
  installSkills,
  loadBundledManifest,
  resolveSkillInstallRoot,
} from "../skills/installer";
import { isJsonMode, json } from "../cli/output";

export interface SkillInstallOptions {
  force?: boolean;
  json?: boolean;
}

export async function runSkillInstall(
  runtime: CliRuntime,
  options: SkillInstallOptions,
): Promise<string> {
  const config = await requireConfig(runtime);
  const manifest = loadBundledManifest();
  const skillInstallRoot = resolveSkillInstallRoot(config);
  const result = await installSkills(runtime, manifest, {
    config,
    force: options.force === true,
  });
  return isJsonMode(options)
    ? json({ ...result, skillInstallRoot })
    : `Installed Skills to ${skillInstallRoot}: ${result.installed.map((item) => item.name).join(", ") || "none"}\nSkipped: ${result.skipped.map((item) => item.name).join(", ") || "none"}\n`;
}

export async function runSkillUpdate(
  runtime: CliRuntime,
  options: SkillInstallOptions,
): Promise<string> {
  return runSkillInstall(runtime, options);
}

export interface SkillStatusOptions {
  json?: boolean;
}

export async function runSkillStatus(
  runtime: CliRuntime,
  options: SkillStatusOptions,
): Promise<string> {
  const config = await requireConfig(runtime);
  const manifest = loadBundledManifest();
  const skillInstallRoot = resolveSkillInstallRoot(config);
  const payload = {
    skillInstallRoot,
    skills: await getSkillStatuses(runtime, manifest, config),
  };
  return isJsonMode(options)
    ? json(payload)
    : payload.skills
        .map(
          (skill) =>
            `${skill.name}: ${skill.status} (${skill.localVersion ?? "not installed"} -> ${skill.remoteVersion})`,
        )
        .join("\n")
        .concat("\n");
}
