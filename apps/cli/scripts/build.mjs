import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSkills } from "./bundle-skills.mjs";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command) {
  execSync(command, { cwd: cliRoot, stdio: "inherit" });
}

run("tsc -p tsconfig.json");
run(
  "tsc-alias -p tsconfig.json --resolve-full-paths --resolve-full-extension .js",
);
await bundleSkills();
