import { Command } from "commander";
import type { CliRuntime } from "../runtime";
import { runInit } from "../commands/init";
import { runStatus } from "../commands/status";
import {
  runAuthLogout,
  runAuthRotate,
  runAuthStatus,
} from "../commands/auth";
import {
  runSkillInstall,
  runSkillStatus,
  runSkillUpdate,
} from "../commands/skill";
import {
  runDaemonLogs,
  runDaemonStart,
  runDaemonStatus,
  runDaemonStop,
} from "../commands/daemon";
import {
  runAppendNote,
  runAttachArtifact,
  runCompleteStage,
  runFailStage,
  runGetRequirement,
  runGetTaskContext,
  runStartStage,
  runUploadArtifact,
} from "../commands/skill-helpers";
import type { CliIo } from "./types";

function globals(command: Command): { json?: boolean } {
  return command.optsWithGlobals();
}

async function writeAction(
  io: CliIo,
  output: Promise<string>,
): Promise<void> {
  io.writeOut(await output);
}

export function createProgram(runtime: CliRuntime, io: CliIo): Command {
  const program = new Command();

  // Must be set before subcommands are registered so they inherit _exitCallback.
  program.exitOverride();
  program.configureOutput({
    writeOut: io.writeOut,
    writeErr: io.writeErr,
  });

  program
    .name("proud-flow")
    .description("Proud Flow CLI")
    .option("--json", "Output JSON")
    .showHelpAfterError();

  program
    .command("init")
    .description("Initialize CLI")
    .option("--env <env>", "Environment (prod or dev)", "prod")
    .option("--machine-name <name>", "Machine name", "local-machine")
    .requiredOption("--bootstrap-token <token>", "Bootstrap token")
    .action(async function (this: Command, options) {
      await writeAction(
        io,
        runInit(runtime, { ...options, ...globals(this) }),
      );
    });

  program
    .command("status")
    .description("Show CLI status")
    .action(async function (this: Command) {
      await writeAction(io, runStatus(runtime, globals(this)));
    });

  const auth = program.command("auth").description("Manage authentication");

  auth
    .command("status")
    .description("Show authentication status")
    .action(async function (this: Command) {
      await writeAction(io, runAuthStatus(runtime, globals(this)));
    });

  auth
    .command("rotate")
    .description("Rotate a token")
    .option("--type <type>", "Token type (skill, dispatcher, local)", "skill")
    .action(async function (this: Command, options) {
      await writeAction(
        io,
        runAuthRotate(runtime, { ...options, ...globals(this) }),
      );
    });

  auth
    .command("logout")
    .description("Log out and clear local tokens")
    .action(async function () {
      await writeAction(io, runAuthLogout(runtime));
    });

  const skill = program.command("skill").description("Manage Skills");

  skill
    .command("install")
    .description("Install Skills from manifest")
    .option("--force", "Force reinstall")
    .action(async function (this: Command, options) {
      await writeAction(
        io,
        runSkillInstall(runtime, { ...options, ...globals(this) }),
      );
    });

  skill
    .command("update")
    .description("Update installed Skills")
    .option("--force", "Force reinstall")
    .action(async function (this: Command, options) {
      await writeAction(
        io,
        runSkillUpdate(runtime, { ...options, ...globals(this) }),
      );
    });

  skill
    .command("status")
    .description("Show Skill install status")
    .action(async function (this: Command) {
      await writeAction(io, runSkillStatus(runtime, globals(this)));
    });

  const daemon = program
    .command("daemon")
    .description("Manage dispatch daemon")
    .option("--foreground", "Run in foreground")
    .action(async function (this: Command, options) {
      await writeAction(
        io,
        runDaemonStart(runtime, { ...options, ...globals(this) }),
      );
    });

  daemon
    .command("status")
    .description("Check daemon status")
    .action(async function (this: Command) {
      await writeAction(io, runDaemonStatus(runtime, globals(this)));
    });

  daemon
    .command("stop")
    .description("Stop daemon")
    .action(async function (this: Command) {
      await writeAction(io, runDaemonStop(runtime, globals(this)));
    });

  daemon
    .command("logs")
    .description("View daemon logs")
    .option("--follow", "Follow log output")
    .option("--lines <n>", "Number of lines to show", "50")
    .action(async function (this: Command, options) {
      await writeAction(io, runDaemonLogs(runtime, options));
    });

  program
    .command("get-requirement <requirementId>")
    .description("Get requirement details")
    .action(async function (this: Command, requirementId: string) {
      await writeAction(
        io,
        runGetRequirement(runtime, requirementId, globals(this)),
      );
    });

  program
    .command("get-task-context <requirementId>")
    .description("Get task context for a requirement")
    .option("--stage <stage>", "Dispatch stage hint (accepted for Skill compatibility)")
    .action(async function (this: Command, requirementId: string) {
      await writeAction(
        io,
        runGetTaskContext(runtime, requirementId, globals(this)),
      );
    });

  program
    .command("start-stage <requirementId>")
    .description("Start a dispatch stage")
    .requiredOption("--stage <stage>", "Dispatch stage")
    .action(async function (this: Command, requirementId: string, options) {
      await writeAction(
        io,
        runStartStage(runtime, requirementId, { ...options, ...globals(this) }),
      );
    });

  program
    .command("attach-artifact <requirementId>")
    .description("Attach an artifact by URL or content")
    .requiredOption("--type <type>", "Artifact type")
    .requiredOption("--title <title>", "Artifact title")
    .option("--url <url>", "Artifact URL")
    .option("--content <content>", "Artifact content")
    .action(async function (this: Command, requirementId: string, options) {
      await writeAction(
        io,
        runAttachArtifact(runtime, requirementId, {
          ...options,
          ...globals(this),
        }),
      );
    });

  program
    .command("upload-artifact <requirementId>")
    .description("Upload an artifact file")
    .requiredOption("--type <type>", "Artifact type")
    .requiredOption("--title <title>", "Artifact title")
    .requiredOption("--file <file>", "File path")
    .option("--content-type <contentType>", "Content type")
    .action(async function (this: Command, requirementId: string, options) {
      await writeAction(
        io,
        runUploadArtifact(runtime, requirementId, {
          ...options,
          ...globals(this),
        }),
      );
    });

  program
    .command("complete-stage <requirementId>")
    .description("Complete a dispatch stage")
    .requiredOption("--stage <stage>", "Dispatch stage")
    .option("--summary <summary>", "Stage summary (accepted for Skill compatibility)")
    .action(async function (this: Command, requirementId: string, options) {
      await writeAction(
        io,
        runCompleteStage(runtime, requirementId, {
          ...options,
          ...globals(this),
        }),
      );
    });

  program
    .command("fail-stage <requirementId>")
    .description("Fail a dispatch stage")
    .requiredOption("--stage <stage>", "Dispatch stage")
    .requiredOption("--message <message>", "Failure message")
    .action(async function (this: Command, requirementId: string, options) {
      await writeAction(
        io,
        runFailStage(runtime, requirementId, { ...options, ...globals(this) }),
      );
    });

  program
    .command("append-note <requirementId>")
    .description("Append a note to a requirement")
    .requiredOption("--message <message>", "Note message")
    .action(async function (this: Command, requirementId: string, options) {
      await writeAction(
        io,
        runAppendNote(runtime, requirementId, { ...options, ...globals(this) }),
      );
    });

  return program;
}
