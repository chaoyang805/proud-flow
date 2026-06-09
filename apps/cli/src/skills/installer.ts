import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CliConfig, CliRuntime } from "../runtime";
import {
  getPackageSkillsRoot,
  loadBundledManifest,
  resolveSkillInstallRoot,
  type BundledSkillManifest,
  type BundledSkillManifestEntry,
} from "./bundled-manifest";

export interface InstalledSkillRecord {
  name: string;
  version: string;
  files: Record<string, string>;
}

export interface SkillInstallResult {
  name: string;
  version: string;
  status: "installed";
}

export interface SkillStatusResult {
  name: string;
  localVersion?: string;
  remoteVersion: string;
  status: "missing" | "installed" | "outdated" | "modified";
}

export interface SkillUpdateResult {
  installed: SkillInstallResult[];
  skipped: Array<{ name: string; reason: "modified" }>;
}

const installRecordFile = ".proud-flow-install.json";

export interface InstallSkillsOptions {
  config: CliConfig;
  force?: boolean;
  packageSkillsRoot?: string;
}

export async function installSkills(
  runtime: CliRuntime,
  manifest: BundledSkillManifest,
  options: InstallSkillsOptions,
): Promise<SkillUpdateResult> {
  const installed: SkillInstallResult[] = [];
  const skipped: Array<{ name: string; reason: "modified" }> = [];
  const packageRoot = options.packageSkillsRoot ?? getPackageSkillsRoot();
  for (const entry of manifest.skills) {
    const current = await getSkillStatus(runtime, entry, options.config);
    if (current.status === "modified" && !options.force) {
      skipped.push({ name: entry.name, reason: "modified" });
      continue;
    }
    installed.push(await installSkill(runtime, entry, options.config, packageRoot));
  }
  return { installed, skipped };
}

export async function getSkillStatuses(
  runtime: CliRuntime,
  manifest: BundledSkillManifest,
  config: CliConfig,
): Promise<SkillStatusResult[]> {
  const statuses: SkillStatusResult[] = [];
  for (const entry of manifest.skills) {
    statuses.push(await getSkillStatus(runtime, entry, config));
  }
  return statuses;
}

export { loadBundledManifest, resolveSkillInstallRoot, getPackageSkillsRoot };

async function installSkill(
  runtime: CliRuntime,
  entry: BundledSkillManifestEntry,
  config: CliConfig,
  packageRoot: string,
): Promise<SkillInstallResult> {
  const root = resolveSkillInstallRoot(config);
  const dir = `${root}/${entry.name}`;
  const fileHashes: Record<string, string> = {};
  for (const filePath of Object.keys(entry.files)) {
    const normalizedPath = normalizePackagePath(filePath);
    const content = readBundledFile(packageRoot, entry.name, normalizedPath);
    fileHashes[normalizedPath] = sha256(content);
    if (fileHashes[normalizedPath] !== entry.files[normalizedPath]) {
      throw new Error("SKILL_PACKAGE_HASH_MISMATCH");
    }
    await runtime.writeFile(`${dir}/${normalizedPath}`, content);
  }
  const record: InstalledSkillRecord = {
    name: entry.name,
    version: entry.version,
    files: fileHashes,
  };
  await runtime.writeFile(
    `${dir}/${installRecordFile}`,
    Buffer.from(JSON.stringify(record, null, 2)),
  );
  return { name: entry.name, version: entry.version, status: "installed" };
}

async function getSkillStatus(
  runtime: CliRuntime,
  entry: BundledSkillManifestEntry,
  config: CliConfig,
): Promise<SkillStatusResult> {
  const record = await readInstallRecord(runtime, entry.name, config);
  if (!record) {
    return {
      name: entry.name,
      remoteVersion: entry.version,
      status: "missing",
    };
  }
  if (await hasLocalModifications(runtime, entry.name, record, config)) {
    return {
      name: entry.name,
      localVersion: record.version,
      remoteVersion: entry.version,
      status: "modified",
    };
  }
  const matchesBundled =
    record.version === entry.version &&
    Object.entries(entry.files).every(
      ([filePath, expectedHash]) => record.files[filePath] === expectedHash,
    );
  return {
    name: entry.name,
    localVersion: record.version,
    remoteVersion: entry.version,
    status: matchesBundled ? "installed" : "outdated",
  };
}

function readBundledFile(
  packageRoot: string,
  skillName: string,
  filePath: string,
): Buffer {
  try {
    return readFileSync(join(packageRoot, skillName, filePath));
  } catch {
    throw new Error("SKILL_PACKAGE_FILE_MISSING");
  }
}

async function readInstallRecord(
  runtime: CliRuntime,
  name: string,
  config: CliConfig,
): Promise<InstalledSkillRecord | undefined> {
  try {
    const content = await runtime.readFile(
      `${resolveSkillInstallRoot(config)}/${name}/${installRecordFile}`,
    );
    return JSON.parse(Buffer.from(content).toString("utf8")) as InstalledSkillRecord;
  } catch {
    return undefined;
  }
}

async function hasLocalModifications(
  runtime: CliRuntime,
  name: string,
  record: InstalledSkillRecord,
  config: CliConfig,
): Promise<boolean> {
  const root = resolveSkillInstallRoot(config);
  for (const [filePath, expectedHash] of Object.entries(record.files)) {
    try {
      const content = await runtime.readFile(`${root}/${name}/${filePath}`);
      if (sha256(content) !== expectedHash) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function normalizePackagePath(path: string): string {
  if (path.startsWith("/") || path.includes("..")) {
    throw new Error("SKILL_PACKAGE_INVALID_PATH");
  }
  return path;
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
