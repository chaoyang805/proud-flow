import type { DispatchStage } from "@proud-flow/domain";

export type AgentKind = "codex" | "claude" | "cursor";

export interface AgentTask {
  stage: DispatchStage;
  requirementId: string;
}

export interface AgentRunner {
  readonly kind: AgentKind;
  run(task: AgentTask): Promise<void>;
}

export interface MockAgentRunner extends AgentRunner {
  calls: AgentTask[];
}

export function createMockAgentRunner(
  options: { kind?: AgentKind; failWith?: string } = {},
): MockAgentRunner {
  const kind = options.kind ?? "codex";
  return {
    kind,
    calls: [],
    async run(task) {
      this.calls.push({ ...task });
      if (options.failWith) throw new Error(options.failWith);
    },
  };
}
