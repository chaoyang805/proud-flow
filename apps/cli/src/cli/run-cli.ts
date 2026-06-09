import { CommanderError } from "commander";
import type { CliRuntime } from "../runtime";
import { createProgram } from "./program";
import { formatError } from "./output";
import type { CliResult } from "./types";

function isHelpExit(error: unknown): boolean {
  return (
    error instanceof CommanderError &&
    (error.code === "commander.helpDisplayed" ||
      error.code === "commander.help" ||
      error.code === "commander.version")
  );
}

function isUnknownCommand(error: unknown): boolean {
  return (
    error instanceof CommanderError && error.code === "commander.unknownCommand"
  );
}

export async function runCli(
  args: readonly string[],
  runtime: CliRuntime,
): Promise<CliResult> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const asJson = args.includes("--json");

  const program = createProgram(runtime, {
    writeOut: (text) => {
      stdoutChunks.push(text);
    },
    writeErr: (text) => {
      stderrChunks.push(text);
    },
  });

  if (args.length === 0) {
    program.outputHelp();
    return {
      exitCode: 0,
      stdout: stdoutChunks.join(""),
      stderr: "",
    };
  }

  try {
    await program.parseAsync([...args], { from: "user" });
    return {
      exitCode: 0,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } catch (error) {
    if (isHelpExit(error)) {
      const exitCode =
        error instanceof CommanderError ? (error.exitCode ?? 0) : 0;
      return {
        exitCode,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      };
    }
    if (isUnknownCommand(error)) {
      const unknown = error as CommanderError;
      const commandName = String(unknown.message).trim() || "unknown";
      return {
        exitCode: 1,
        stdout: "",
        stderr: formatError(new Error(`Unknown command: ${commandName}`), asJson),
      };
    }
    return {
      exitCode: 1,
      stdout: "",
      stderr: formatError(error, asJson),
    };
  }
}
