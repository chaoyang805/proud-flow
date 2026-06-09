import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const E2E_WRANGLER_ENV = "e2e";

export interface E2eWranglerDev {
  apiUrl: string;
  port: number;
  persistDir: string;
  process: ChildProcess;
  stop(): Promise<void>;
}

function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const response = await fetch(url);
        if (response.ok || response.status < 500) return resolve();
      } catch {
        // wrangler may not be accepting connections yet
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server not ready: ${url}`));
      }
      setTimeout(check, 500);
    };
    check();
  });
}

async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function waitForExit(child: ChildProcess, timeoutMs = 10_000): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ok
      }
      resolve();
    }, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function waitForSkillAuth(
  apiUrl: string,
  skillToken: string,
  timeoutMs = 15_000,
): Promise<void> {
  const start = Date.now();
  let lastStatus = 0;
  let lastBody = "";
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${apiUrl}/api/skills/requirements/REQ-000000`, {
      headers: { Authorization: `Bearer ${skillToken}` },
    });
    lastStatus = response.status;
    lastBody = await response.text();
    if (response.status === 404) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `Skill token auth did not become ready (last status ${lastStatus}: ${lastBody})`,
  );
}

export async function startE2eWranglerDev(root: string): Promise<E2eWranglerDev> {
  const persistDir = join(tmpdir(), `pf-e2e-wrangler-${Date.now()}`);
  mkdirSync(persistDir, { recursive: true });
  const port = await allocatePort();
  const apiUrl = `http://127.0.0.1:${port}`;

  const child = spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--config",
      "apps/api/wrangler.jsonc",
      "--env",
      E2E_WRANGLER_ENV,
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--persist-to",
      persistDir,
    ],
    { cwd: root, stdio: "pipe", env: { ...process.env } },
  );

  child.stdout?.on("data", (chunk) => {
    const text = String(chunk);
    if (text.includes("Ready")) {
      console.log("[e2e]", text.trim());
    }
  });

  await waitForServer(`${apiUrl}/api/health`);
  await waitForServer(`${apiUrl}/api/requirements`);

  return {
    apiUrl,
    port,
    persistDir,
    process: child,
    async stop() {
      try {
        child.kill("SIGTERM");
      } catch {
        // ok
      }
      await waitForExit(child);
      rmSync(persistDir, { recursive: true, force: true });
    },
  };
}
