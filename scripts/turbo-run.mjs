import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { workspaceOrder } from "./workspaces.mjs";

const task = process.argv[2];
if (!task) {
  console.error("Usage: node scripts/turbo-run.mjs <task>");
  process.exit(1);
}

for (const workspace of workspaceOrder) {
  const packageJson = JSON.parse(
    await readFile(`${workspace}/package.json`, "utf8"),
  );
  const script = packageJson.scripts?.[task];
  if (!script) continue;

  console.log(`• ${packageJson.name} ${task}`);
  const result = spawnSync("pnpm", ["--dir", workspace, "run", task], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
