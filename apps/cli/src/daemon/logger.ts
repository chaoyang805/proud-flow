import { join } from "node:path";
import { homedir } from "node:os";
import pino from "pino";

export function resolveConfigDir(): string {
  return process.env.PROUD_FLOW_CONFIG_DIR ?? join(homedir(), ".proud-flow");
}

export function resolveLogPath(): string {
  return join(resolveConfigDir(), "daemon.log");
}

export function resolvePidPath(): string {
  return join(resolveConfigDir(), "daemon.pid");
}

export function createLogger(logPath?: string): pino.Logger {
  const path = logPath ?? resolveLogPath();
  return pino(
    pino.transport({
      targets: [
        {
          target: "pino-roll",
          options: { file: path, size: "10m", count: 5 },
        },
      ],
    }),
  );
}
