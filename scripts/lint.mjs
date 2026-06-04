import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { workspaceOrder } from "./workspaces.mjs";

const files = execFileSync(
  "rg",
  [
    "--files",
    "-g",
    "*.ts",
    "-g",
    "*.mjs",
    "-g",
    "*.js",
    "-g",
    "!dist",
    "-g",
    "!coverage",
    "-g",
    "!node_modules",
  ],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

for (const workspace of workspaceOrder) {
  const packageJson = JSON.parse(
    await readFile(`${workspace}/package.json`, "utf8"),
  );
  if (!packageJson.scripts?.lint)
    throw new Error(`${workspace} is missing a lint script`);
}

for (const file of files) {
  const content = await readFile(file, "utf8");
  if (/try\s*\{\s*(?:import|await\s+import)/m.test(content)) {
    throw new Error(`${file} wraps an import in try/catch, which is forbidden`);
  }
  if (/[ \t]$/m.test(content)) {
    throw new Error(`${file} contains trailing whitespace`);
  }
}

console.log(`Lint passed for ${files.length} source/config files.`);
