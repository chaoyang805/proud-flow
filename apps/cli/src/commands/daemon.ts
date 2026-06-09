import process from "node:process";
import { existsSync } from "node:fs";
import { runWebSocketLoop } from "../daemon/child-entry";
import {
  createConsoleLogger,
  readDaemonLogTail,
  type DaemonLogger,
} from "../daemon/logger";
import {
  logPath,
  readPid,
  writePid,
  removePid,
  isProcessAlive,
  resolveCliBinPath,
  spawnDaemon,
  terminateProcess,
} from "../daemon/spawn";
import {
  DispatcherAuthError,
  verifyDispatcherAuth,
} from "../daemon/verify-dispatcher-auth";
import type { CliRuntime } from "../runtime";
import { requireConfig } from "../cli/clients";
import { isJsonMode, json } from "../cli/output";

export interface DaemonStatusOptions {
  json?: boolean;
}

export async function runDaemonStatus(
  _runtime: CliRuntime,
  options: DaemonStatusOptions,
): Promise<string> {
  const pid = readPid();
  if (!pid) {
    return isJsonMode(options) ? json({ running: false }) : "Daemon not running\n";
  }
  if (isProcessAlive(pid)) {
    return isJsonMode(options)
      ? json({ running: true, pid })
      : `Daemon running (PID: ${pid})\n`;
  }
  removePid();
  return isJsonMode(options) ? json({ running: false }) : "Daemon not running\n";
}

export interface DaemonStopOptions {
  json?: boolean;
}

export async function runDaemonStop(
  _runtime: CliRuntime,
  options: DaemonStopOptions,
): Promise<string> {
  const pid = readPid();
  if (!pid) {
    return isJsonMode(options) ? json({ stopped: false }) : "Daemon not running\n";
  }
  const stopped = await terminateProcess(pid);
  if (readPid() === pid) {
    removePid();
  }
  if (!stopped) {
    return isJsonMode(options)
      ? json({ stopped: false, pid })
      : `Failed to stop daemon (PID: ${pid})\n`;
  }
  return isJsonMode(options)
    ? json({ stopped: true, pid })
    : `Daemon stopped (PID: ${pid})\n`;
}

export interface DaemonLogsOptions {
  lines?: string;
  follow?: boolean;
}

export async function runDaemonLogs(
  _runtime: CliRuntime,
  options: DaemonLogsOptions,
): Promise<string> {
  const { execSync } = await import("node:child_process");
  const lines = Number(options.lines) || 50;
  const follow = options.follow === true;
  const logFile = logPath();
  const hasCurrent = existsSync(logFile);
  const tail = readDaemonLogTail(lines);

  if (!hasCurrent && tail.length === 0) {
    return "No daemon log found\n";
  }

  if (tail.length === 0) {
    return "Daemon log is empty\n";
  }

  if (follow) {
    execSync(`tail -n ${lines} -f "${logFile}"`, {
      stdio: "inherit",
    });
    return "";
  }

  return `${tail}\n`;
}

export interface DaemonStartOptions {
  foreground?: boolean;
  json?: boolean;
}

export async function runDaemonStart(
  runtime: CliRuntime,
  options: DaemonStartOptions,
): Promise<string> {
  const existingPid = readPid();
  const logger = createDaemonConsoleLogger();

  if (existingPid && isProcessAlive(existingPid) && existingPid !== process.pid) {
    logger.info({ existingPid }, "stopping existing daemon");
    await terminateProcess(existingPid);
    removePid();
  } else {
    removePid();
  }

  if (options.foreground === true) {
    return daemonForeground(runtime, logger);
  }

  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("dispatcher");
  if (!token) throw new Error("Missing dispatcher token");

  await verifyDaemonAuth(logger, {
    environment: config.environment ?? "prod",
    env: runtime.env,
    token,
    fetch: runtime.fetch,
  });

  const { pid } = spawnDaemon({
    binPath: resolveCliBinPath(),
  });

  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!isProcessAlive(pid)) {
    removePid();
    throw new Error(
      `Daemon exited immediately. Check log: ${logPath()}`,
    );
  }

  writePid(pid);
  return isJsonMode(options)
    ? json({ started: true, pid, log: logPath() })
    : `Daemon started (PID: ${pid}, log: ${logPath()})\n`;
}

function createDaemonConsoleLogger(): DaemonLogger {
  return createConsoleLogger(true);
}

async function verifyDaemonAuth(
  logger: DaemonLogger,
  options: Parameters<typeof verifyDispatcherAuth>[0],
): Promise<void> {
  logger.info({}, "verifying dispatcher token");
  try {
    await verifyDispatcherAuth(options);
  } catch (error) {
    if (error instanceof DispatcherAuthError) {
      logger.error({ code: error.code }, error.message);
      throw new DispatcherAuthError(error.message, error.code, true);
    }
    throw error;
  }
  logger.info({}, "authentication successful");
}

async function daemonForeground(
  runtime: CliRuntime,
  logger = createDaemonConsoleLogger(),
): Promise<string> {
  const config = await requireConfig(runtime);
  const token = await runtime.keychain.getToken("dispatcher");
  if (!token) throw new Error("Missing dispatcher token");

  logger.info(
    { environment: config.environment ?? "prod", pid: process.pid },
    "starting foreground",
  );
  await verifyDaemonAuth(logger, {
    environment: config.environment ?? "prod",
    env: runtime.env,
    token,
    fetch: runtime.fetch,
  });

  const loop = runWebSocketLoop({
    env: runtime.env,
    environment: config.environment ?? "prod",
    token,
    logger,
    fetch: runtime.fetch,
  });

  await new Promise<void>((resolve) => {
    let exiting = false;
    const shutdown = (signal: string) => {
      if (exiting) return;
      exiting = true;
      loop.stop();
      logger.info({ signal }, "shutting down");
      process.exit(0);
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  });

  return "";
}
