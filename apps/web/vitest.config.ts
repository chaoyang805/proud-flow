import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.{test.ts,test.tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/components/artifacts/artifact-list.tsx",
        "src/components/requirements/requirements-workspace.tsx",
        "src/components/review/action-panel.tsx",
        "src/components/auth/token-guard.tsx",
        "src/lib/auth/token-store.ts",
        "src/lib/realtime/events.ts",
        "src/lib/requirements/labels.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
