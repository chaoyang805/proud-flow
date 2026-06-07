import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolvePidPath, resolveLogPath } from "./logger";

export function configDir(): string {
  return process.env.PROUD_FLOW_CONFIG_DIR ?? resolvePidPath().split("/").slice(0, -1).join("/");
}

export function pidPath(): string {
  return resolvePidPath();
}

export function logPath(): string {
  return resolveLogPath();
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readPid(): number | undefined {
  try {
    const data = readFileSync(resolvePidPath(), "utf8");
    return Number(data.trim());
  } catch {
    return undefined;
  }
}

export function writePid(pid: number): void {
  const path = resolvePidPath();
  ensureDir(path);
  writeFileSync(path, String(pid), "utf8");
}

export function removePid(): void {
  try {
    unlinkSync(resolvePidPath());
  } catch {
    // ignore
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface SpawnOptions {
  binPath: string;
}

export function spawnDaemon(options: SpawnOptions): { pid: number } {
  const child = spawn(
    process.execPath,
    [options.binPath, "--daemon-child"],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    },
  );

  child.unref();
  return { pid: child.pid! };
}
