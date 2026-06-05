import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "NEXT_TELEMETRY_DISABLED=1 pnpm -C apps/web exec next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/requirements",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
