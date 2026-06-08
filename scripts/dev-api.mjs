#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/api");
const DEFAULT_PORT = "8787";

let warmupDone = false;

async function warmup(port = DEFAULT_PORT) {
  if (warmupDone) return;
  const url = `http://127.0.0.1:${port}/api/health`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        warmupDone = true;
        console.log(`[dev-api] repository warmed up via ${url}`);
        return;
      }
    } catch {
      // wrangler may not be accepting connections yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.warn("[dev-api] warmup timed out; repository will bootstrap on first request");
}

void warmup();

const child = spawn(
  "pnpm",
  ["exec", "wrangler", "dev", "--config", "wrangler.jsonc", "--env", "dev", "--ip", "127.0.0.1"],
  { cwd: apiDir, stdio: "inherit", shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
