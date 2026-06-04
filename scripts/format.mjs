import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "--check";
const args = mode === "--write" ? ["--write", "."] : ["--check", "."];
const result = spawnSync("prettier", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
