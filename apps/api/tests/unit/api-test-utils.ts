// @ts-nocheck
import assert from "node:assert/strict";
import { createApiApp, hashToken } from "../../src/test-utils";

export async function json(response) {
  return response.json();
}

export async function request(app, path, options = {}, env) {
  return app.fetch(
    new Request(`https://api.test${path}`, {
      method: options.method ?? "GET",
      headers: options.body
        ? { "Content-Type": "application/json", ...(options.headers ?? {}) }
        : options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
    env,
  );
}

export async function createRequirement(app) {
  const response = await request(app, "/api/requirements", {
    method: "POST",
    body: { title: "需求", description: "描述", priority: "high" },
  });
  assert.equal(response.status, 201);
  return json(response);
}

export async function bootstrapLocal(app) {
  const bootstrapHash = await hashToken("bootstrap-secret", "pepper");
  const env = {
    BOOTSTRAP_TOKEN_HASHES: bootstrapHash,
    TOKEN_HASH_SECRET: "pepper",
  };
  const response = await request(
    app,
    "/api/local/bootstrap",
    {
      method: "POST",
      body: { bootstrapToken: "bootstrap-secret", machineName: "dev-mac" },
    },
    env,
  );
  assert.equal(response.status, 201);
  return { env, body: await json(response) };
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

export { createApiApp };
