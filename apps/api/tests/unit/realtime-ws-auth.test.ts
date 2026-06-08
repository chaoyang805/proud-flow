import { describe, expect, it } from "vitest";
import { createApiApp, hashToken } from "../../src/test-utils";

describe("realtime WebSocket auth", () => {
  it("ignores non-WS paths", async () => {
    const app = createApiApp();
    const response = await app.fetch(
      new Request("https://api.test/api/requirements"),
      {},
    );
    expect(response.status).toBe(200);
  });

  it("returns the right status codes based on WS upgrade and runtime", async () => {
    const app = createApiApp();
    const userHash = await hashToken("pf_user_secret", "pepper");
    const env = { USER_TOKEN_HASHES: userHash, TOKEN_HASH_SECRET: "pepper" };

    // No token → 401
    const noToken = await app.fetch(
      new Request("https://api.test/api/realtime/ws"),
      env,
    );
    expect(noToken.status).toBe(401);

    // Wrong token → 403
    const wrongToken = await app.fetch(
      new Request("https://api.test/api/realtime/ws", {
        headers: { Authorization: "Bearer wrong_token" },
      }),
      env,
    );
    expect(wrongToken.status).toBe(403);

    // Correct token, no upgrade header → 426
    const noUpgrade = await app.fetch(
      new Request("https://api.test/api/realtime/ws", {
        headers: { Authorization: "Bearer pf_user_secret" },
      }),
      env,
    );
    expect(noUpgrade.status).toBe(426);
    expect(await noUpgrade.text()).toContain("WebSocket upgrade required");

    // Correct token via query param, no upgrade header → also 426
    const queryToken = await app.fetch(
      new Request("https://api.test/api/realtime/ws?token=pf_user_secret"),
      env,
    );
    expect(queryToken.status).toBe(426);
  });

  it("allows user access when no USER_TOKEN_HASHES configured", async () => {
    const app = createApiApp();

    const response = await app.fetch(
      new Request("https://api.test/api/realtime/ws", {
        headers: { Authorization: "Bearer any_token" },
      }),
      {},
    );
    expect(response.status).toBe(426);
  });
});
