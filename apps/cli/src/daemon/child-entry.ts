import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { createLogger, type DaemonLogger } from "./logger";
import { createNodeCliRuntime } from "../runtime";
import { getBackendUrl } from "../environment";
import { createCodexCliRunner } from "./codex-runner";
import { createDaemon } from "./daemon";
import {
  AUTH_FAILED_CODE,
  DispatcherAuthError,
  verifyDispatcherAuth,
} from "./verify-dispatcher-auth";
import {
  isProcessAlive,
  readPid,
  removePid,
  writePid,
} from "./spawn";

export interface DaemonChildOptions {
  binPath: string;
}

export interface WebSocketLoopHandle {
  stop(): void;
}

export async function startDaemonChild(
  _options: DaemonChildOptions,
): Promise<void> {
  const logger = await createLogger(true);

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "unhandled rejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaught exception");
  });

  logger.info({ pid: process.pid }, "daemon child started");

  const runtime = createNodeCliRuntime();
  const config = await runtime.store.readConfig();
  if (!config) {
    logger.error("CLI not initialized (no config found)");
    process.exit(1);
    return;
  }

  const token = await runtime.keychain.getToken("dispatcher");
  if (!token) {
    logger.error("missing dispatcher token");
    process.exit(1);
    return;
  }

  const environment = config.environment ?? "prod";

  try {
    await verifyDispatcherAuth({
      environment,
      env: runtime.env,
      token,
      fetch: runtime.fetch,
    });
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "dispatcher authentication failed",
    );
    process.exit(1);
    return;
  }

  const existingPid = readPid();
  if (existingPid && existingPid !== process.pid && isProcessAlive(existingPid)) {
    logger.error({ existingPid }, "another daemon is already running");
    process.exit(1);
    return;
  }
  writePid(process.pid);

  const loop = runWebSocketLoop({
    env: runtime.env,
    environment,
    token,
    workspacePath: config.workspacePath,
    logger,
    fetch: runtime.fetch,
  });

  await waitForShutdownSignal(loop, logger);
}

function waitForShutdownSignal(
  loop: WebSocketLoopHandle,
  logger: DaemonLogger,
): Promise<void> {
  return new Promise((resolve) => {
    let exiting = false;
    const shutdown = (signal: string) => {
      if (exiting) return;
      exiting = true;
      loop.stop();
      if (readPid() === process.pid) {
        removePid();
      }
      logger.info({ signal }, "shutting down");
      resolve();
      process.exit(0);
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  });
}

export interface WebSocketLoopOptions {
  env: Record<string, string | undefined>;
  environment: string;
  token: string;
  workspacePath: string;
  logger: DaemonLogger;
  fetch?: typeof fetch;
}

export function buildWebSocketUrl(
  environment: string,
  env: Record<string, string | undefined>,
  token: string,
): string {
  return `${getBackendUrl(
    environment as "prod" | "dev",
    env,
  ).replace(/^http/, "ws")}/api/dispatch/ws?token=${encodeURIComponent(token)}`;
}

export function computeRetryDelay(attempt: number): number {
  return Math.min(30_000, 600 * 2 ** Math.max(0, attempt));
}

function exitOnAuthFailure(error: unknown, logger: DaemonLogger): void {
  const message =
    error instanceof DispatcherAuthError
      ? error.message
      : `${AUTH_FAILED_CODE}: ${error instanceof Error ? error.message : String(error)}`;
  logger.error({}, message);
  process.exit(1);
}

export function runWebSocketLoop(opts: WebSocketLoopOptions): WebSocketLoopHandle {
  const wsUrl = buildWebSocketUrl(opts.environment, opts.env, opts.token);
  const logger = opts.logger;

  logger.info({ wsUrl }, "WebSocket URL prepared");

  let stopped = false;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let activeWs: WebSocket | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    activeWs?.close();
    activeWs = undefined;
  };

  const scheduleRetry = async (reason: string) => {
    if (stopped || retryTimer) return;

    try {
      await verifyDispatcherAuth({
        environment: opts.environment,
        env: opts.env,
        token: opts.token,
        fetch: opts.fetch,
      });
    } catch (error) {
      if (
        error instanceof DispatcherAuthError &&
        error.code === AUTH_FAILED_CODE
      ) {
        exitOnAuthFailure(error, logger);
        return;
      }
    }

    const delay = computeRetryDelay(retryCount);
    logger.info({ retryMs: delay, reason }, "WebSocket disconnected, retrying");
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, delay);
    retryCount += 1;
  };

  const skillsRoot = join(opts.workspacePath, ".codex", "skills");
  if (!existsSync(skillsRoot)) {
    logger.info(
      { skillsRoot },
      "Proud Flow skills not installed; run `proud-flow skill install`",
    );
  }

  const connect = () => {
    if (stopped) return;
    logger.info({}, "connecting WebSocket...");
    const ws = new WebSocket(wsUrl);
    activeWs = ws;
    const runner = createCodexCliRunner({
      workspacePath: opts.workspacePath,
      onLog: (line, stream) => {
        logger.debug({ stream }, line);
      },
    });
    const daemon = createDaemon({
      runner,
      send: async (message) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          logger.debug({ type: message.type }, "sent");
        }
      },
    });

    ws.onopen = () => {
      retryCount = 0;
      logger.info({}, "WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = String(event.data);
      handleWebSocketMessage(ws, data, daemon, logger);
    };

    ws.onclose = (event) => {
      if (stopped) return;
      logger.info(
        { code: event.code, reason: event.reason || undefined },
        "WebSocket closed",
      );
      void scheduleRetry("close");
    };

    ws.onerror = () => {
      if (stopped) return;
      logger.error(
        {},
        "WebSocket connection failed (check dispatcher token and API)",
      );
      void scheduleRetry("error");
    };
  };

  connect();
  return { stop };
}

export function handleWebSocketMessage(
  ws: WebSocket,
  data: string,
  daemon: ReturnType<typeof createDaemon>,
  logger: DaemonLogger,
): void {
  try {
    const msg = JSON.parse(data);
    logger.debug({ type: msg.type }, "received");
    if (msg.type === "dispatcher.ping") {
      ws.send(JSON.stringify({ type: "dispatcher.pong", timestamp: new Date().toISOString() }));
      return;
    }
    if (msg.type === "dispatch.requested") {
      logger.info({ requestId: msg.requestId, requirement: msg.requirementId, stage: msg.stage }, "dispatch");
      daemon.receive(msg);
      return;
    }
  } catch {
    logger.debug({ raw: data }, "raw message");
  }
}
