import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import process from "node:process";
import pino from "pino";
import pretty from "pino-pretty";
import pinoRoll from "pino-roll";

export interface DaemonLogger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
  debug(obj: object, msg?: string): void;
}

const PRETTY_OPTIONS = {
  translateTime: "SYS:standard",
  ignore: "pid,hostname",
  singleLine: true,
  messageFormat: "[daemon] {msg}",
} as const;

export function resolveConfigDir(): string {
  return process.env.PROUD_FLOW_CONFIG_DIR ?? join(homedir(), ".proud-flow");
}

export function resolveRollBasePath(): string {
  return join(resolveConfigDir(), "daemon");
}

export function resolveLogPath(): string {
  return join(resolveConfigDir(), "current.log");
}

export function resolvePidPath(): string {
  return join(resolveConfigDir(), "daemon.pid");
}

export function listArchivedLogFiles(): string[] {
  const configDir = resolveConfigDir();
  if (!existsSync(configDir)) {
    return [];
  }
  return readdirSync(configDir)
    .filter((name) => /^daemon\.\d+\.log$/.test(name))
    .sort((left, right) => {
      const leftNum = Number(left.match(/\.(\d+)\.log$/)?.[1] ?? 0);
      const rightNum = Number(right.match(/\.(\d+)\.log$/)?.[1] ?? 0);
      return leftNum - rightNum;
    })
    .map((name) => join(configDir, name));
}

export function readDaemonLogTail(lines: number): string {
  const configDir = resolveConfigDir();
  const sources: string[] = [];

  for (const archived of listArchivedLogFiles()) {
    sources.push(readFileSync(archived, "utf8"));
  }

  const currentLog = resolveLogPath();
  if (existsSync(currentLog)) {
    try {
      sources.push(readFileSync(currentLog, "utf8"));
    } catch {
      // symlink target may be missing; archived files still count
    }
  }

  if (sources.length === 0) {
    return "";
  }

  const allLines = sources.join("\n").split("\n").filter(Boolean);
  return allLines.slice(-lines).join("\n");
}

export async function createLogger(sync = false): Promise<pino.Logger> {
  const roll = await pinoRoll({
    file: resolveRollBasePath(),
    size: "10m",
    limit: { count: 5 },
    symlink: true,
    mkdir: true,
  });
  const stream = pretty({
    ...PRETTY_OPTIONS,
    colorize: false,
    destination: roll,
    sync,
  });
  return pino(stream);
}

export function createConsoleLogger(sync = true): DaemonLogger {
  const stream = pretty({
    ...PRETTY_OPTIONS,
    colorize: Boolean(process.stdout.isTTY),
    destination: 1,
    sync,
  });
  return pino(stream);
}
