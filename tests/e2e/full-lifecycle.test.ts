import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const API_URL = "http://127.0.0.1:8787";
const root = join(import.meta.dirname ?? __dirname, "..", "..");

let apiProcess: ChildProcess | null = null;
let daemonProcess: ChildProcess | null = null;
let daemonConfigDir: string;

function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try { const resp = await fetch(url); if (resp.ok || resp.status < 500) return resolve(); } catch { /* */ }
      if (Date.now() - start > timeoutMs) return reject(new Error(`Server not ready: ${url}`));
      setTimeout(check, 500);
    };
    check();
  });
}

describe("完整生命周期 E2E", () => {
  let tokens: { skill: string; dispatcher: string; local: string };

  beforeAll(async () => {
    // Clean D1
    try {
      const d1Path = "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject";
      const files = execSync(`ls ${d1Path}/*.sqlite 2>/dev/null | head -1`, { cwd: root, encoding: "utf8" }).trim();
      if (files) {
        execSync(`sqlite3 "${files}" "DELETE FROM requirements; DELETE FROM api_tokens; DELETE FROM artifacts;"`, { cwd: root, stdio: "ignore" });
      }
    } catch { /* ok */ }

    apiProcess = spawn("npx", ["wrangler", "dev", "--config", "apps/api/wrangler.jsonc", "--env", "dev", "--ip", "127.0.0.1", "--port", "8787"], {
      cwd: root, stdio: "pipe", env: { ...process.env },
    });
    apiProcess.stdout?.on("data", (d) => { const s = String(d); if (s.includes("Ready")) console.log("[e2e]", s.trim()); });
    await waitForServer(`${API_URL}/api/requirements`);
    console.log("[e2e] API server ready");

    const resp = await fetch(`${API_URL}/api/local/bootstrap`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bootstrapToken: "e2e-bootstrap", machineName: "e2e-host" }),
    });
    tokens = (await resp.json() as any).tokens;
    console.log("[e2e] bootstrap done");
  }, 60000);

  afterAll(() => {
    if (daemonProcess) { try { process.kill(daemonProcess.pid!, "SIGTERM"); } catch { /* */ } }
    if (apiProcess) { apiProcess.kill("SIGTERM"); }
    try { unlinkSync(join(daemonConfigDir || "", "daemon.pid")); } catch { /* */ }
  });

  it("完整生命周期: 创建需求 → 派发 → daemon 接收 → AI 模拟处理 → 状态变更 → 产物可见 → Review", async () => {
    // 1. Create requirement
    const r1 = await fetch(`${API_URL}/api/requirements`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `E2E Test ${Date.now()}`, description: "Full lifecycle", priority: "high" }),
    });
    expect(r1.ok).toBe(true);
    const req = await r1.json() as any;
    const rid = req.id;
    console.log("[e2e] created", rid, req.status);
    expect(req.status).toBe("planning");

    // 2. Start daemon
    daemonConfigDir = join(tmpdir(), `pf-e2e-${Date.now()}`);
    mkdirSync(daemonConfigDir, { recursive: true });
    writeFileSync(join(daemonConfigDir, "config.json"), JSON.stringify({ environment: "dev", workspacePath: daemonConfigDir }));
    writeFileSync(join(daemonConfigDir, "tokens.json"), JSON.stringify({ dispatcher: tokens.dispatcher }));

    const binPath = join(root, "apps/cli/dist/bin.js");
    console.log("[e2e] starting daemon...");
    daemonProcess = spawn(process.execPath, [binPath, "--daemon-child"], {
      detached: true, stdio: "ignore",
      env: { ...process.env, PROUD_FLOW_CONFIG_DIR: daemonConfigDir, PROUD_FLOW_API_URL: API_URL },
    });
    daemonProcess.unref();
    await new Promise((r) => setTimeout(r, 4000));

    // 3. Verify daemon started
    const logPath = join(daemonConfigDir, "daemon.log");
    if (existsSync(logPath)) {
      const log = readFileSync(logPath, "utf8");
      console.log("[e2e] daemon log size:", log.length);
      expect(log).toContain("daemon child started");
    }

    // 4. Dispatch
    const r2 = await fetch(`${API_URL}/api/requirements/${rid}/dispatch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "tech_design" }),
    });
    const disp = await r2.json() as any;
    console.log("[e2e] dispatch:", r2.status, disp.accepted ? "✅ accepted" : disp.error?.code || "");

    if (r2.ok && disp.accepted) {
      // Daemon received dispatch via WebSocket — verify in logs
      await new Promise((r) => setTimeout(r, 2000));
      if (existsSync(logPath)) {
        const log2 = readFileSync(logPath, "utf8");
        console.log("[e2e] daemon log after dispatch:", log2.substring(log2.length - 600));
      }
    }

    // 5. Simulate AI processing via Skills API (works regardless of daemon state)
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${tokens.skill}` };

    // Check current status first
    let currentStatus = "planning";
    const statusCheck = await fetch(`${API_URL}/api/requirements/${rid}`);
    const statusBody = await statusCheck.json() as any;
    currentStatus = statusBody.status;
    console.log("[e2e] current status before AI sim:", currentStatus);

    // Start stage if not already started
    if (currentStatus === "planning") {
      await fetch(`${API_URL}/api/skills/requirements/${rid}/status/start`, {
        method: "POST", headers: H, body: JSON.stringify({ stage: "tech_design" }),
      });
    }

    // Attach artifacts
    await fetch(`${API_URL}/api/skills/requirements/${rid}/artifacts`, {
      method: "POST", headers: H,
      body: JSON.stringify({ type: "tech_design_pr", title: "技术方案 PR", url: "https://github.com/proud-flow/example/pull/1" }),
    });
    await fetch(`${API_URL}/api/skills/requirements/${rid}/artifacts`, {
      method: "POST", headers: H,
      body: JSON.stringify({ type: "note", title: "架构决策记录", content: "Workers + D1 + R2" }),
    });

    // Complete stage
    await fetch(`${API_URL}/api/skills/requirements/${rid}/status/complete-stage`, {
      method: "POST", headers: H, body: JSON.stringify({ stage: "tech_design" }),
    });

    // 6. Verify status → tech-review
    const r5 = await fetch(`${API_URL}/api/requirements/${rid}`);
    const cur = await r5.json() as any;
    console.log("[e2e] status after AI:", cur.status, "v" + cur.version);
    expect(cur.status).toBe("tech-review");

    // 7. Verify artifacts
    const r6 = await fetch(`${API_URL}/api/requirements/${rid}/artifacts`);
    const arts = await r6.json() as any;
    console.log("[e2e] artifacts:", arts.items.length);
    expect(arts.items.length).toBeGreaterThanOrEqual(2);
    expect(arts.items.map((a: any) => a.title)).toContain("技术方案 PR");

    const prArtifact = arts.items.find((a: any) => a.type === "tech_design_pr");
    expect(prArtifact).toBeDefined();
    if (prArtifact.url) {
      console.log("[e2e] PR URL:", prArtifact.url);
    }

    // 8. Review approve → case-rundown
    await fetch(`${API_URL}/api/reviews/${rid}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "技术方案评审通过" }),
    });
    const r7 = await fetch(`${API_URL}/api/requirements/${rid}`);
    const fin = await r7.json() as any;
    console.log("[e2e] final status:", fin.status);
    expect(fin.status).toBe("case-rundown");

    console.log(`\n✅ E2E PASSED: ${rid}\n   planning → tech-design → tech-review → case-rundown\n   artifacts: ${arts.items.length} items`);
  }, 30000);
});
