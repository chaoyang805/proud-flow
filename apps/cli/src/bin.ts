#!/usr/bin/env node
import process from "node:process";
import { createNodeCliRuntime } from "./runtime";
import { runCli } from "./cli";

const result = await runCli(process.argv.slice(2), createNodeCliRuntime());
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
