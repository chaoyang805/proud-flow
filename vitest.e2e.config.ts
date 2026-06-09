import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": path.resolve(
        rootDir,
        "apps/api/tests/mocks/cloudflare-workers.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
  },
});
