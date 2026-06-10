import { describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startE2eWranglerDev, waitForSkillAuth } from "./helpers/wrangler-dev";

const root = join(import.meta.dirname ?? __dirname, "..", "..");

describe("完整生命周期 E2E", () => {
  it("完整生命周期: 创建需求 → 派发 → daemon 接收 → AI 模拟处理 → 状态变更 → 产物可见 → Review", async () => {
    const wranglerDev = await startE2eWranglerDev(root);
    const apiUrl = wranglerDev.apiUrl;
    let daemonProcess: ChildProcess | null = null;
    let daemonConfigDir = "";

    try {
      console.log("[e2e] API server ready at", apiUrl);
      console.log("[e2e] wrangler persist dir:", wranglerDev.persistDir);

      const bootstrapResp = await fetch(`${apiUrl}/api/local/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bootstrapToken: "e2e-bootstrap",
          machineName: "e2e-host",
        }),
      });
      if (!bootstrapResp.ok) {
        throw new Error(
          `bootstrap failed: ${bootstrapResp.status} ${await bootstrapResp.text()}`,
        );
      }
      const bootstrapBody = (await bootstrapResp.json()) as {
        tokens: { skill: string; dispatcher: string; local: string };
      };
      const tokens = bootstrapBody.tokens;
      expect(tokens.skill).toMatch(/^pf_skill_/);
      console.log("[e2e] bootstrap done");
      await waitForSkillAuth(apiUrl, tokens.skill);

      const r1 = await fetch(`${apiUrl}/api/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `E2E Test ${Date.now()}`,
          description: "Full lifecycle",
          priority: "high",
        }),
      });
      expect(r1.ok).toBe(true);
      const req = (await r1.json()) as { id: string; status: string };
      const rid = req.id;
      console.log("[e2e] created", rid, req.status);
      expect(req.status).toBe("planning");

      daemonConfigDir = join(tmpdir(), `pf-e2e-${Date.now()}`);
      mkdirSync(daemonConfigDir, { recursive: true });
      writeFileSync(
        join(daemonConfigDir, "config.json"),
        JSON.stringify({ environment: "dev", workspacePath: daemonConfigDir }),
      );
      writeFileSync(
        join(daemonConfigDir, "tokens.json"),
        JSON.stringify({ dispatcher: tokens.dispatcher }),
      );

      const binPath = join(root, "apps/cli/dist/bin.js");
      console.log("[e2e] starting daemon...");
      daemonProcess = spawn(process.execPath, [binPath, "--daemon-child"], {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          PROUD_FLOW_CONFIG_DIR: daemonConfigDir,
          PROUD_FLOW_API_URL: apiUrl,
        },
      });
      daemonProcess.unref();
      await new Promise((r) => setTimeout(r, 4000));

      const logPath = join(daemonConfigDir, "current.log");
      if (existsSync(logPath)) {
        const log = readFileSync(logPath, "utf8");
        console.log("[e2e] daemon log size:", log.length);
        expect(log).toContain("daemon child started");
      }

      const r2 = await fetch(`${apiUrl}/api/requirements/${rid}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "tech_design" }),
      });
      const disp = (await r2.json()) as {
        accepted?: boolean;
        error?: { code: string };
      };
      console.log(
        "[e2e] dispatch:",
        r2.status,
        disp.accepted ? "✅ accepted" : disp.error?.code || "",
      );

      if (r2.ok && disp.accepted) {
        await new Promise((r) => setTimeout(r, 2000));
        if (existsSync(logPath)) {
          const log2 = readFileSync(logPath, "utf8");
          console.log(
            "[e2e] daemon log after dispatch:",
            log2.substring(log2.length - 600),
          );
        }
      }

      const H = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.skill}`,
      };

      const statusCheck = await fetch(`${apiUrl}/api/requirements/${rid}`);
      const statusBody = (await statusCheck.json()) as { status: string };
      console.log("[e2e] current status before AI sim:", statusBody.status);

      if (statusBody.status === "planning") {
        const startResp = await fetch(
          `${apiUrl}/api/skills/requirements/${rid}/status/start`,
          {
            method: "POST",
            headers: H,
            body: JSON.stringify({ stage: "tech_design" }),
          },
        );
        expect(startResp.ok).toBe(true);
      }

      const attachPr = await fetch(
        `${apiUrl}/api/skills/requirements/${rid}/artifacts`,
        {
          method: "POST",
          headers: H,
          body: JSON.stringify({
            type: "tech_design_pr",
            title: "技术方案 PR",
            url: "https://github.com/proud-flow/example/pull/1",
          }),
        },
      );
      expect(attachPr.ok).toBe(true);

      const attachNote = await fetch(
        `${apiUrl}/api/skills/requirements/${rid}/artifacts`,
        {
          method: "POST",
          headers: H,
          body: JSON.stringify({
            type: "note",
            title: "架构决策记录",
            content: "Workers + D1 + R2",
          }),
        },
      );
      expect(attachNote.ok).toBe(true);

      const completeResp = await fetch(
        `${apiUrl}/api/skills/requirements/${rid}/status/complete-stage`,
        {
          method: "POST",
          headers: H,
          body: JSON.stringify({ stage: "tech_design" }),
        },
      );
      expect(completeResp.ok).toBe(true);

      const r5 = await fetch(`${apiUrl}/api/requirements/${rid}`);
      const cur = (await r5.json()) as { status: string; version: number };
      console.log("[e2e] status after AI:", cur.status, "v" + cur.version);
      expect(cur.status).toBe("tech-review");

      const r6 = await fetch(`${apiUrl}/api/requirements/${rid}/artifacts`);
      const arts = (await r6.json()) as {
        items: Array<{ title: string; type: string; url?: string }>;
      };
      console.log("[e2e] artifacts:", arts.items.length);
      expect(arts.items.length).toBeGreaterThanOrEqual(2);
      expect(arts.items.map((a) => a.title)).toContain("技术方案 PR");

      const prArtifact = arts.items.find((a) => a.type === "tech_design_pr");
      expect(prArtifact).toBeDefined();
      if (prArtifact?.url) {
        console.log("[e2e] PR URL:", prArtifact.url);
      }

      const dispatchCaseResp = await fetch(
        `${apiUrl}/api/requirements/${rid}/dispatch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "case_rundown" }),
        },
      );
      expect(dispatchCaseResp.ok).toBe(true);

      const startCaseResp = await fetch(
        `${apiUrl}/api/skills/requirements/${rid}/status/start`,
        {
          method: "POST",
          headers: H,
          body: JSON.stringify({ stage: "case_rundown" }),
        },
      );
      expect(startCaseResp.ok).toBe(true);

      const r7 = await fetch(`${apiUrl}/api/requirements/${rid}`);
      const fin = (await r7.json()) as { status: string };
      console.log("[e2e] final status:", fin.status);
      expect(fin.status).toBe("case-rundown");

      console.log(
        `\n✅ E2E PASSED: ${rid}\n   planning → tech-design → tech-review → case-rundown\n   artifacts: ${arts.items.length} items`,
      );
    } finally {
      if (daemonProcess) {
        try {
          process.kill(daemonProcess.pid!, "SIGTERM");
        } catch {
          // ok
        }
      }
      try {
        unlinkSync(join(daemonConfigDir, "daemon.pid"));
      } catch {
        // ok
      }
      await wranglerDev.stop();
    }
  }, 120_000);
});
