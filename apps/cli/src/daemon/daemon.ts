import { dispatchMessageSchema } from "@proud-flow/api-contract";
import type { DispatchAckedMessage, DispatchMessage } from "@proud-flow/domain";
import { createStageCommand } from "./stage-router";
import type { CodexRunner } from "./codex-runner";

export interface ProudFlowDaemon {
  receive(message: unknown): Promise<void>;
}

export interface ProudFlowDaemonOptions {
  runner: CodexRunner;
  send(message: DispatchMessage): Promise<void>;
  now?: () => string;
  dedupeLimit?: number;
}

export function createDaemon(options: ProudFlowDaemonOptions): ProudFlowDaemon {
  const now = options.now ?? (() => new Date().toISOString());
  const acknowledgements = new Map<string, DispatchAckedMessage>();
  const dedupeLimit = options.dedupeLimit ?? 100;
  let busy = false;

  async function sendAck(ack: DispatchAckedMessage): Promise<void> {
    acknowledgements.set(ack.requestId, ack);
    while (acknowledgements.size > dedupeLimit) {
      const oldest = acknowledgements.keys().next().value;
      if (!oldest) break;
      acknowledgements.delete(oldest);
    }
    await options.send(ack);
  }

  return {
    async receive(message) {
      if (!dispatchMessageSchema.is(message)) {
        await options.send({
          type: "dispatch.acked",
          requestId: "dispatch_req_invalid",
          success: false,
          errorMessage: "VALIDATION_ERROR",
        });
        return;
      }

      if (message.type === "dispatcher.ping") {
        await options.send({ type: "dispatcher.pong", timestamp: now() });
        return;
      }

      if (message.type !== "dispatch.requested") return;

      const previous = acknowledgements.get(message.requestId);
      if (previous) {
        await options.send(previous);
        return;
      }

      if (busy) {
        await sendAck({
          type: "dispatch.acked",
          requestId: message.requestId,
          success: false,
          errorMessage: "DISPATCHER_BUSY",
        });
        return;
      }

      busy = true;
      try {
        await options.runner.run(
          createStageCommand(message.stage, message.requirementId),
        );
        await sendAck({
          type: "dispatch.acked",
          requestId: message.requestId,
          success: true,
        });
      } catch (error) {
        await sendAck({
          type: "dispatch.acked",
          requestId: message.requestId,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : "Codex unavailable",
        });
      } finally {
        busy = false;
      }
    },
  };
}

export function getReconnectDelayMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}
