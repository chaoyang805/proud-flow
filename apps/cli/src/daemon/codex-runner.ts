import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import type { AgentRunner } from "./agent-runner";
import { createStagePrompt } from "./stage-router";

export type CodexSandbox = "read-only" | "workspace-write" | "danger-full-access";

export interface CodexSpawnOptions {
  cwd?: string;
  stdio?: ["ignore", "pipe", "pipe"];
  detached?: boolean;
  env?: NodeJS.ProcessEnv;
}

export type CodexSpawnFn = (
  command: string,
  args: readonly string[],
  options: CodexSpawnOptions,
) => ChildProcess;

export interface CodexCliRunnerOptions {
  workspacePath: string;
  sandbox?: CodexSandbox;
  spawnFn?: CodexSpawnFn;
  onLog?: (line: string, stream: "stdout" | "stderr") => void;
}

function attachLogForwarding(
  child: ChildProcess,
  onLog?: (line: string, stream: "stdout" | "stderr") => void,
): void {
  if (!onLog) return;

  child.stdout?.on("data", (chunk: Buffer | string) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.length > 0) onLog(line, "stdout");
    }
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.length > 0) onLog(line, "stderr");
    }
  });
}

export function createCodexCliRunner(
  options: CodexCliRunnerOptions,
): AgentRunner {
  const sandbox = options.sandbox ?? "danger-full-access";
  const spawnFn = options.spawnFn ?? nodeSpawn;

  return {
    kind: "codex",
    run(task) {
      const prompt = createStagePrompt(task.stage, task.requirementId);
      const args = ["exec", "--sandbox", sandbox, prompt] as const;

      return new Promise<void>((resolve, reject) => {
        const child = spawnFn("codex", args, {
          cwd: options.workspacePath,
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
          env: process.env,
        });

        attachLogForwarding(child, options.onLog);

        child.once("spawn", () => {
          child.unref();
          resolve();
        });

        child.once("error", (error) => {
          const message =
            error instanceof Error ? error.message : "CODEX_START_FAILED";
          if (message.includes("ENOENT")) {
            reject(new Error("CODEX_NOT_CONNECTED"));
            return;
          }
          reject(new Error(message || "CODEX_START_FAILED"));
        });
      });
    },
  };
}
