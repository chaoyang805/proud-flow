import process from "node:process";
import { createLogger } from "./logger";
import { createNodeCliRuntime } from "../runtime";
import { getBackendUrl } from "../environment";
import { createMockCodexRunner } from "./codex-runner";
import { createDaemon } from "./daemon";

export interface DaemonChildOptions {
  binPath: string;
}

export function startDaemonChild(_options: DaemonChildOptions): void {
  const logger = createLogger();

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "unhandled rejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaught exception");
  });

  logger.info({ pid: process.pid }, "daemon child started");

  const runtime = createNodeCliRuntime();
  runtime.store.readConfig().then((config) => {
    if (!config) {
      logger.error("CLI not initialized (no config found)");
      process.exit(1);
    }

    runtime.keychain.getToken("dispatcher").then((token) => {
      if (!token) {
        logger.error("missing dispatcher token");
        process.exit(1);
      }

      runWebSocketLoop({
        env: runtime.env,
        environment: config.environment ?? "prod",
        token,
        logger,
      });
    });
  });
}

export interface WebSocketLoopOptions {
  env: Record<string, string | undefined>;
  environment: string;
  token: string;
  logger: ReturnType<typeof createLogger>;
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

export function runWebSocketLoop(opts: WebSocketLoopOptions): void {
  const wsUrl = buildWebSocketUrl(opts.environment, opts.env, opts.token);
  const logger = opts.logger;

  logger.info({ wsUrl }, "WebSocket URL prepared");

  let retryCount = 0;

  const connect = () => {
    logger.info("connecting WebSocket...");
    const ws = new WebSocket(wsUrl);
    const runner = createMockCodexRunner();
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
      logger.info("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = String(event.data);
      handleWebSocketMessage(ws, data, daemon, logger);
    };

    ws.onclose = () => {
      const delay = computeRetryDelay(retryCount);
      logger.info({ retryMs: delay }, "WebSocket closed, retrying");
      setTimeout(connect, delay);
      retryCount += 1;
    };

    ws.onerror = (err) => {
      logger.error({ err }, "WebSocket error");
    };
  };

  connect();
}

export function handleWebSocketMessage(
  ws: WebSocket,
  data: string,
  daemon: ReturnType<typeof createDaemon>,
  logger: ReturnType<typeof createLogger>,
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
