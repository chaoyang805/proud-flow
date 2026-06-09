import { mkdir, writeFile } from "node:fs/promises";

const paths = [
  "/api/requirements",
  "/api/requirements/{id}",
  "/api/requirements/{id}/reviews/approve",
  "/api/requirements/{id}/reviews/rollback",
  "/api/requirements/{id}/dispatch",
  "/api/requirements/{id}/artifacts",
  "/api/artifacts/upload",
  "/api/realtime/events",
  "/api/skills/requirements/{id}",
  "/api/skills/requirements/{id}/task-context",
  "/api/skills/requirements/{id}/status/start",
  "/api/skills/requirements/{id}/artifacts",
  "/api/skills/requirements/{id}/artifacts/upload",
  "/api/skills/requirements/{id}/complete-stage",
  "/api/skills/requirements/{id}/fail-stage",
  "/api/skills/requirements/{id}/notes",
  "/api/local/bootstrap",
  "/api/local/tokens/rotate",
  "/api/local/tokens/revoke",
];

const document = {
  openapi: "3.1.0",
  info: { title: "Proud Flow API", version: "0.1.0" },
  paths: Object.fromEntries(paths.map((path) => [path, {}])),
};

await mkdir(new URL("../generated", import.meta.url), { recursive: true });
await writeFile(
  new URL("../generated/openapi.json", import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);
