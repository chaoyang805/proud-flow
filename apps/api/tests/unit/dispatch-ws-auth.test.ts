import { describe, expect, it } from "vitest";
import { createApiApp, hashToken } from "../../src/test-utils";

async function readJson(response: Response) {
  return response.json();
}

function request(
  app: ReturnType<typeof createApiApp>,
  path: string,
  options: RequestInit = {},
  env = {},
) {
  return app.fetch(
    new Request(`https://api.test${path}`, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
    }),
    env,
  );
}

describe("dispatch WebSocket auth route", () => {
  it("returns 200 for GET /api/requirements without auth tokens", async () => {
    const app = createApiApp();
    const response = await request(app, "/api/requirements");
    expect(response.status).toBe(200);
  });

  it("allows only dispatcher tokens to access the dispatch WebSocket endpoint", async () => {
    const app = createApiApp();
    const dispatcherHash = await hashToken("pf_dispatcher_secret", "pepper");
    const env = {
      DISPATCHER_TOKEN_HASHES: dispatcherHash,
      TOKEN_HASH_SECRET: "pepper",
    };

    const missing = await request(app, "/api/dispatch/ws", {}, env);
    expect(missing.status).toBe(401);

    const wrong = await readJson(
      await request(
        app,
        "/api/dispatch/ws",
        { headers: { Authorization: "Bearer pf_skill_secret" } },
        env,
      ),
    );
    expect(wrong.error.code).toBe("FORBIDDEN");

    const authorized = await request(
      app,
      "/api/dispatch/ws",
      { headers: { Authorization: "Bearer pf_dispatcher_secret" } },
      env,
    );
    expect(authorized.status).toBe(426);
    expect(await authorized.text()).toContain("WebSocket upgrade required");

    const upgradeWithoutRuntime = await request(
      app,
      "/api/dispatch/ws",
      {
        headers: {
          Authorization: "Bearer pf_dispatcher_secret",
          Upgrade: "websocket",
        },
      },
      env,
    );
    expect(upgradeWithoutRuntime.status).toBe(501);
  });

  it("accepts dispatcher tokens created through local bootstrap", async () => {
    const app = createApiApp();
    const bootstrapHash = await hashToken("bootstrap-secret", "pepper");
    const env = {
      BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
      TOKEN_HASH_SECRET: "pepper",
    };
    const bootstrap = await readJson(
      await request(
        app,
        "/api/local/bootstrap",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bootstrapToken: "bootstrap-secret",
            machineName: "dev-mac",
          }),
        },
        env,
      ),
    );

    const response = await request(
      app,
      "/api/dispatch/ws",
      { headers: { Authorization: `Bearer ${bootstrap.tokens.dispatcher}` } },
      env,
    );
    expect(response.status).toBe(426);
  });
});

describe("dispatch POST auth", () => {
  it("requires user token for POST /api/requirements/:id/dispatch", async () => {
    const app = createApiApp();
    const userHash = await hashToken("pf_user_secret", "pepper");
    const env = {
      USER_TOKEN_HASHES: userHash,
      TOKEN_HASH_SECRET: "pepper",
    };

    // Create a requirement first
    const createResp = await readJson(
      await request(
        app,
        "/api/requirements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer pf_user_secret" },
          body: JSON.stringify({ title: "测试", description: "描述", priority: "high" }),
        },
        env,
      ),
    );

    // Without token → 401
    const noToken = await request(
      app,
      `/api/requirements/${createResp.id}/dispatch`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: "tech_design" }) },
      env,
    );
    expect(noToken.status).toBe(401);

    // With skill token → 403
    const skillResp = await readJson(
      await request(
        app,
        `/api/requirements/${createResp.id}/dispatch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer pf_skill_123" },
          body: JSON.stringify({ stage: "tech_design" }),
        },
        env,
      ),
    );
    expect(skillResp.error.code).toBe("FORBIDDEN");

    // With user token → 503 (no daemon connected, but auth passes)
    const userResp = await request(
      app,
      `/api/requirements/${createResp.id}/dispatch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer pf_user_secret" },
        body: JSON.stringify({ stage: "tech_design" }),
      },
      env,
    );
    expect(userResp.status).toBe(503);
    const userBody = await readJson(userResp);
    expect(userBody.error.code).toBe("DISPATCHER_OFFLINE");
  });
});
