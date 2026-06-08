import { describe, expect, it } from "vitest";
import { createProudFlowApiClient } from "../../packages/api-client/src/index";
import type { ArtifactType, DispatchStage } from "../../packages/domain/src/index";
import { createApiApp, hashToken } from "../../apps/api/src/test-utils";
import {
  createDaemon,
  createMemoryCliRuntime,
  runCli,
} from "../../apps/cli/src/index";

describe("P8 full lifecycle e2e", () => {
  it("runs the first requirement lifecycle through backend, CLI helper, daemon via WS dispatch, Skill actions, review, realtime, and archive", async () => {
    const app = createApiApp();
    const bootstrapHash = await hashToken("p8-bootstrap", "pepper");
    const env = {
      BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
      TOKEN_HASH_SECRET: "pepper",
    };
    const runtime = createMemoryCliRuntime({
      fetch: (url, init) =>
        app.fetch(
          new Request(String(url), {
            method: init?.method,
            headers: init?.headers,
            body: init?.body,
          }),
          env,
        ),
      env: { PROUD_FLOW_API_URL: "https://api.test" },
    });

    const init = await runCli(
      ["init", "--env", "dev", "--bootstrap-token", "p8-bootstrap", "--machine-name", "p8-daemon"],
      runtime,
    );
    expect(init.exitCode).toBe(0);

    const client = createProudFlowApiClient({
      baseUrl: "https://api.test",
      fetch: runtime.fetch,
    });
    const requirement = await client.requirements.create({
      title: "完整生命周期",
      description: "P8 full lifecycle",
      priority: "high",
    });
    expect(requirement.status).toBe("planning");

    // Register daemon client
    let dispatchCallback: ((msg: any) => void) | null = null;
    app.hub.registerDispatchClient((msg) => {
      dispatchCallback?.(msg);
    });

    const daemon = createDaemon({
      runner: {
        async run(command) {
          const [, skillName, requirementId] = command.match(/^\/([a-z-]+) (REQ-\d{6})$/) ?? [];
          if (!skillName || !requirementId) throw new Error("Invalid command");
          const stage = skillNameToStage(skillName);
          const artifact = stageArtifact(stage);

          expect((await runCli(["get-task-context", requirementId, "--json"], runtime)).exitCode).toBe(0);
          expect((await runCli(["start-stage", requirementId, "--stage", stage, "--json"], runtime)).exitCode).toBe(0);
          expect((await runCli(["attach-artifact", requirementId, "--type", artifact, "--title", `${stage} artifact`, "--json"], runtime)).exitCode).toBe(0);
          expect((await runCli(["complete-stage", requirementId, "--stage", stage, "--json"], runtime)).exitCode).toBe(0);
        },
      },
      send: async (message) => {
        // Record ACK as realtime event
        const ack = message as any;
        app.hub.broadcast({
          type: "dispatch.acked",
          eventId: `evt_${Date.now().toString(36)}`,
          requirementId: ack.requirementId ?? requirement.id,
          success: ack.success,
          message: ack.success ? "Dispatch acknowledged" : (ack.errorMessage ?? "Dispatch failed"),
        });
      },
    });

    await runDispatchCycle({
      app, client, runtime, daemon, requirementId: requirement.id, stage: "tech_design",
      dispatchCallback: (cb) => { dispatchCallback = cb; },
    });
    expect((await client.requirements.get(requirement.id)).status).toBe("tech-review");

    expect((await client.reviews.approve(requirement.id, { note: "技术方案通过" })).requirement.status).toBe("case-rundown");
    await runDispatchCycle({
      app, client, runtime, daemon, requirementId: requirement.id, stage: "case_rundown",
      dispatchCallback: (cb) => { dispatchCallback = cb; },
    });
    expect((await client.requirements.get(requirement.id)).status).toBe("case-review");

    expect((await client.reviews.approve(requirement.id, { note: "用例通过" })).requirement.status).toBe("developing");
    await runDispatchCycle({
      app, client, runtime, daemon, requirementId: requirement.id, stage: "development",
      dispatchCallback: (cb) => { dispatchCallback = cb; },
    });
    expect((await client.requirements.get(requirement.id)).status).toBe("delivery");

    await client.artifacts.create(requirement.id, { type: "acceptance_record", title: "验收记录", content: "用户验收通过" });
    await client.requirements.archive(requirement.id);
    expect((await client.requirements.get(requirement.id)).status).toBe("archived");
  });
});

async function runDispatchCycle(options: {
  app: ReturnType<typeof createApiApp>;
  client: ReturnType<typeof createProudFlowApiClient>;
  runtime: ReturnType<typeof createMemoryCliRuntime>;
  daemon: ReturnType<typeof createDaemon>;
  requirementId: string;
  stage: DispatchStage;
  dispatchCallback: (cb: (msg: any) => void) => void;
}) {
  // WS mode: daemon receives dispatch via registered callback
  let receivedMsg: any = null;
  options.dispatchCallback((msg) => { receivedMsg = msg; });

  const dispatched = await options.client.dispatch.dispatch(options.requirementId, { stage: options.stage });
  expect(dispatched.accepted).toBe(true);

  // Simulate daemon receiving the WS message
  expect(receivedMsg).not.toBeNull();
  await options.daemon.receive(receivedMsg);
}

function skillNameToStage(skillName: string): DispatchStage {
  if (skillName === "tech-design") return "tech_design";
  if (skillName === "case-rundown") return "case_rundown";
  if (skillName === "develop") return "development";
  throw new Error(`Unknown skill: ${skillName}`);
}

function stageArtifact(stage: DispatchStage): ArtifactType {
  if (stage === "tech_design") return "tech_design_pr";
  if (stage === "case_rundown") return "case_rundown_pr";
  return "development_pr";
}
