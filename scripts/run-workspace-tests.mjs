import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();

if (existsSync("vitest.config.ts") && hasTypeScriptTests("tests/unit")) {
  const vitestResult = spawnSync(
    "pnpm",
    ["exec", "vitest", "run", "--passWithNoTests"],
    {
      cwd,
      stdio: "inherit",
    },
  );
  if (vitestResult.status !== 0) process.exit(vitestResult.status ?? 1);
  process.exit(0);
}

console.error("No TypeScript unit tests found.");
process.exit(1);

function hasTypeScriptTests(directory) {
  if (!existsSync(directory)) return false;
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const itemPath = path.join(directory, item.name);
    if (item.isDirectory() && hasTypeScriptTests(itemPath)) return true;
    if (
      item.isFile() &&
      (item.name.endsWith(".test.ts") || item.name.endsWith(".test.tsx"))
    )
      return true;
  }
  return false;
}
