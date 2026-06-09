import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "vitest";

const root = process.cwd();

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, filePath), "utf8")) as T;
}

describe("P9 release readiness", () => {
  it("configures Cloudflare API deployment for dev and production", async () => {
    const rootPackage = await readJson<{
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    }>("package.json");
    const wrangler = await readJson<{
      name: string;
      main: string;
      compatibility_date: string;
      compatibility_flags: string[];
      observability: { enabled: boolean };
      d1_databases: Array<{ binding: string; database_name: string }>;
      r2_buckets: Array<{ binding: string; bucket_name: string }>;
      durable_objects: { bindings: Array<{ name: string; class_name: string }> };
      env: Record<
        string,
        {
          name: string;
          vars: Record<string, string>;
          d1_databases: Array<{ binding: string; database_name: string }>;
          r2_buckets: Array<{ binding: string; bucket_name: string }>;
        }
      >;
    }>("apps/api/wrangler.jsonc");

    assert.ok(rootPackage.devDependencies.wrangler);
    assert.equal(rootPackage.scripts["deploy:api:dev"], "pnpm --filter @proud-flow/api deploy:dev");
    assert.equal(rootPackage.scripts["deploy:api:prod"], "pnpm --filter @proud-flow/api deploy:prod");
    assert.equal(rootPackage.scripts["db:migrate:dev"], "pnpm --filter @proud-flow/api db:migrate:dev");
    assert.equal(rootPackage.scripts["db:migrate:prod"], "pnpm --filter @proud-flow/api db:migrate:prod");
    assert.equal(wrangler.name, "proud-flow-api");
    assert.equal(wrangler.main, "src/index.ts");
    assert.match(wrangler.compatibility_date, /^2026-06-\d{2}$/);
    assert.ok(wrangler.compatibility_flags.includes("nodejs_compat"));
    assert.equal(wrangler.observability.enabled, true);
    assert.deepEqual(
      wrangler.durable_objects.bindings.map((binding) => binding.name).sort(),
      ["DISPATCH_DO", "REALTIME_DO"],
    );
    assert.equal(wrangler.env.dev.name, "proud-flow-api-dev");
    assert.equal(wrangler.env.production.name, "proud-flow-api-prod");
    assert.equal(wrangler.env.dev.vars.ENVIRONMENT, "dev");
    assert.equal(wrangler.env.production.vars.ENVIRONMENT, "prod");
    assert.equal(wrangler.env.dev.d1_databases[0].binding, "DB");
    assert.equal(wrangler.env.production.r2_buckets[0].binding, "ARTIFACT_BUCKET");
  });

  it("prepares web, CLI, and Skill release assets", async () => {
    const rootPackage = await readJson<{ scripts: Record<string, string> }>(
      "package.json",
    );
    const webPackage = await readJson<{
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    }>("apps/web/package.json");
    const webWrangler = await readJson<{
      main: string;
      compatibility_flags: string[];
      assets: { directory: string; binding: string };
      env: Record<string, { vars: Record<string, string> }>;
    }>("apps/web/wrangler.jsonc");
    const cliPackage = await readJson<{
      private?: boolean;
      bin: Record<string, string>;
      files: string[];
    }>("apps/cli/package.json");
    const webProdEnv = await readFile(
      path.join(root, "apps/web/.env.production"),
      "utf8",
    );
    const skillManifest = await readJson<{
      skills: Array<{ name: string; files: Record<string, string> }>;
    }>("apps/cli/dist/package-skills/manifest.json");

    assert.equal(rootPackage.scripts["deploy:web:dev"], "pnpm --filter @proud-flow/web deploy:dev");
    assert.equal(rootPackage.scripts["deploy:web:prod"], "pnpm --filter @proud-flow/web deploy:prod");
    assert.equal(rootPackage.scripts["publish:cli"], "pnpm --filter @proud-flow/cli publish:package");
    assert.equal(rootPackage.scripts["release:check"], "node scripts/check-release-readiness.mjs");
    assert.ok(webPackage.devDependencies["@opennextjs/cloudflare"]);
    assert.match(webPackage.scripts["deploy:prod"], /opennextjs-cloudflare deploy/);
    assert.equal(webWrangler.main, ".open-next/worker.js");
    assert.equal(webWrangler.assets.directory, ".open-next/assets");
    assert.ok(webWrangler.compatibility_flags.includes("nodejs_compat"));
    assert.equal(
      webWrangler.env.production.vars.NEXT_PUBLIC_PROUD_FLOW_API_URL,
      "https://api.proud-flow.example",
    );
    assert.equal(cliPackage.private, false);
    assert.equal(cliPackage.bin["proud-flow"], "./dist/bin.js");
    assert.deepEqual(cliPackage.files, ["dist"]);
    assert.match(
      webProdEnv,
      /^NEXT_PUBLIC_PROUD_FLOW_API_URL=https:\/\/api\.proud-flow\.example$/m,
    );
    assert.equal(skillManifest.skills.length, 3);
    for (const skill of skillManifest.skills) {
      for (const hash of Object.values(skill.files)) {
        assert.match(hash, /^[a-f0-9]{64}$/);
      }
    }
  });

  it("documents local setup, deployment, and troubleshooting", async () => {
    const files = [
      "README.md",
      "docs/local-development.md",
      "docs/deployment.md",
      "docs/troubleshooting.md",
    ];

    for (const file of files) {
      const content = await readFile(path.join(root, file), "utf8");
      assert.match(content, /proud-flow/);
      assert.ok(content.length > 500);
    }
  });
});
