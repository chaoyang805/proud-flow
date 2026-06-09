import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bundleSkills } from "../apps/cli/scripts/bundle-skills.mjs";

const root = process.cwd();

async function readJson(filePath) {
  return JSON.parse(await readFile(path.join(root, filePath), "utf8"));
}

async function readText(filePath) {
  return readFile(path.join(root, filePath), "utf8");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rootPackage = await readJson("package.json");
const apiWrangler = await readJson("apps/api/wrangler.jsonc");
const webPackage = await readJson("apps/web/package.json");
const webWrangler = await readJson("apps/web/wrangler.jsonc");
const cliPackage = await readJson("apps/cli/package.json");
const webProdEnv = await readText("apps/web/.env.production");
await bundleSkills();
const manifest = await readJson("apps/cli/dist/package-skills/manifest.json");

assert(rootPackage.devDependencies?.wrangler, "Missing root wrangler devDependency");
assert(rootPackage.scripts?.["deploy:api:prod"], "Missing deploy:api:prod script");
assert(rootPackage.scripts?.["deploy:web:prod"], "Missing deploy:web:prod script");
assert(rootPackage.scripts?.["publish:cli"], "Missing publish:cli script");
assert(apiWrangler.env?.dev, "Missing Cloudflare dev environment");
assert(apiWrangler.env?.production, "Missing Cloudflare production environment");
assert(webPackage.devDependencies?.["@opennextjs/cloudflare"], "Missing OpenNext Cloudflare adapter");
assert(webWrangler.main === ".open-next/worker.js", "Missing OpenNext worker entry");
assert(webWrangler.assets?.directory === ".open-next/assets", "Missing OpenNext assets binding");
assert(
  apiWrangler.durable_objects?.bindings?.length === 2,
  "Missing Durable Object bindings",
);
assert(
  webProdEnv.includes("NEXT_PUBLIC_PROUD_FLOW_API_URL=https://api.proud-flow.example"),
  "Missing production API URL for web",
);
assert(cliPackage.private === false, "CLI package must be publishable");
assert(cliPackage.bin?.["proud-flow"] === "./dist/bin.js", "Missing CLI bin entry");
assert(cliPackage.files?.includes("dist"), "CLI package must ship dist");

for (const skill of manifest.skills ?? []) {
  for (const [filePath, expectedHash] of Object.entries(skill.files ?? {})) {
    const content = await readFile(
      path.join(root, "apps/cli/dist/package-skills", skill.name, filePath),
    );
    assert(
      sha256(content) === expectedHash,
      `Bundled skill hash mismatch: ${skill.name}/${filePath}`,
    );
  }
}

for (const file of [
  "README.md",
  "docs/local-development.md",
  "docs/deployment.md",
  "docs/troubleshooting.md",
]) {
  const content = await readText(file);
  assert(content.includes("proud-flow"), `${file} must mention proud-flow`);
}

console.log("Release readiness checks passed");
