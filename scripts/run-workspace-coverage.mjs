import { spawnSync } from "node:child_process";

const result = spawnSync(
  "node",
  [
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-include=dist/**/*.js",
    "--test-coverage-exclude=dist/**/*.d.ts",
    "--test-coverage-lines=80",
    "--test-coverage-functions=80",
    "--test-coverage-branches=80",
    "tests/unit/*.test.mjs",
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
