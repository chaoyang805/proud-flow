import { createHash } from "node:crypto";
import type {
  SkillManifestEntry,
  SkillManifestResponse,
} from "@proud-flow/api-contract";
import type { CliRuntime } from "../runtime";

export interface InstalledSkillRecord {
  name: string;
  version: string;
  packageSha256: string;
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

interface SkillPackageFile {
  path: string;
  content: string;
}

interface SkillPackage {
  name: string;
  version: string;
  files: SkillPackageFile[];
}

const installRecordFile = ".proud-flow-install.json";

export async function installSkills(
  runtime: CliRuntime,
  manifest: SkillManifestResponse,
  options: { force?: boolean } = {},
): Promise<SkillUpdateResult> {
  const installed: SkillInstallResult[] = [];
  const skipped: Array<{ name: string; reason: "modified" }> = [];
  for (const entry of manifest.skills) {
    const current = await getSkillStatus(runtime, entry);
    if (current.status === "modified" && !options.force) {
      skipped.push({ name: entry.name, reason: "modified" });
      continue;
    }
    installed.push(await installSkill(runtime, entry));
  }
  return { installed, skipped };
}

export async function getSkillStatuses(
  runtime: CliRuntime,
  manifest: SkillManifestResponse,
): Promise<SkillStatusResult[]> {
  const statuses: SkillStatusResult[] = [];
  for (const entry of manifest.skills) {
    statuses.push(await getSkillStatus(runtime, entry));
  }
  return statuses;
}

async function installSkill(
  runtime: CliRuntime,
  entry: SkillManifestEntry,
): Promise<SkillInstallResult> {
  const bytes = await downloadSkillPackage(runtime, entry);
  const pkg = parseSkillPackage(bytes);
  if (pkg.name !== entry.name || pkg.version !== entry.version) {
    throw new Error("SKILL_PACKAGE_METADATA_MISMATCH");
  }
  const root = skillRoot(runtime);
  const dir = `${root}/${entry.name}`;
  const fileHashes: Record<string, string> = {};
  for (const file of pkg.files) {
    const normalizedPath = normalizePackagePath(file.path);
    fileHashes[normalizedPath] = sha256(Buffer.from(file.content));
    await runtime.writeFile(
      `${dir}/${normalizedPath}`,
      Buffer.from(file.content),
    );
  }
  const record: InstalledSkillRecord = {
    name: entry.name,
    version: entry.version,
    packageSha256: entry.sha256,
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
  entry: SkillManifestEntry,
): Promise<SkillStatusResult> {
  const record = await readInstallRecord(runtime, entry.name);
  if (!record) {
    return {
      name: entry.name,
      remoteVersion: entry.version,
      status: "missing",
    };
  }
  if (await hasLocalModifications(runtime, entry.name, record)) {
    return {
      name: entry.name,
      localVersion: record.version,
      remoteVersion: entry.version,
      status: "modified",
    };
  }
  return {
    name: entry.name,
    localVersion: record.version,
    remoteVersion: entry.version,
    status:
      record.version === entry.version && record.packageSha256 === entry.sha256
        ? "installed"
        : "outdated",
  };
}

async function downloadSkillPackage(
  runtime: CliRuntime,
  entry: SkillManifestEntry,
): Promise<Uint8Array> {
  const response = await runtime.fetch(entry.downloadUrl);
  if (!response.ok) throw new Error("SKILL_PACKAGE_DOWNLOAD_FAILED");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (sha256(bytes) !== entry.sha256) {
    throw new Error("SKILL_PACKAGE_HASH_MISMATCH");
  }
  return bytes;
}

async function readInstallRecord(
  runtime: CliRuntime,
  name: string,
): Promise<InstalledSkillRecord | undefined> {
  try {
    const content = await runtime.readFile(
      `${skillRoot(runtime)}/${name}/${installRecordFile}`,
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
): Promise<boolean> {
  for (const [filePath, expectedHash] of Object.entries(record.files)) {
    try {
      const content = await runtime.readFile(`${skillRoot(runtime)}/${name}/${filePath}`);
      if (sha256(content) !== expectedHash) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function parseSkillPackage(bytes: Uint8Array): SkillPackage {
  const pkg = JSON.parse(Buffer.from(bytes).toString("utf8")) as SkillPackage;
  if (!pkg.name || !pkg.version || !Array.isArray(pkg.files)) {
    throw new Error("SKILL_PACKAGE_INVALID");
  }
  return pkg;
}

function normalizePackagePath(path: string): string {
  if (path.startsWith("/") || path.includes("..")) {
    throw new Error("SKILL_PACKAGE_INVALID_PATH");
  }
  return path;
}

function skillRoot(runtime: CliRuntime): string {
  if (runtime.env.CODEX_HOME) return `${runtime.env.CODEX_HOME}/skills`;
  if (runtime.env.HOME) return `${runtime.env.HOME}/.codex/skills`;
  return `${runtime.cwd}/.codex/skills`;
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
