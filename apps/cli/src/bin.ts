#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createNodeCliRuntime } from "./runtime";
import { runCli } from "./cli";
import { startDaemonChild } from "./daemon/child-entry";

const args = process.argv.slice(2);

if (args.includes("--daemon-child")) {
  startDaemonChild({ binPath: fileURLToPath(import.meta.url) });
} else {
  const result = await runCli(args, createNodeCliRuntime());
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
