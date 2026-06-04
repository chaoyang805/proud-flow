import { spawnSync } from "node:child_process";

const result = spawnSync("node", ["--test", "tests/unit/*.test.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
});
process.exit(result.status ?? 1);
