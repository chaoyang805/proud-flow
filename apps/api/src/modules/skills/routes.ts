import { type IRequestStrict, Router, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireSkillToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import type { SkillsApiService } from "./service";

export function installSkillsModule(
  router: RouterType,
  service: SkillsApiService,
  repository: IRequirementRepository,
) {
  router
    .get("/api/skills/requirements/:id", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.getRequirement(request.params.id));
    })
    .get("/api/skills/requirements/:id/task-context", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.getTaskContext(request.params.id));
    })
    .post("/api/skills/requirements/:id/status/start", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.startStage(request.params.id, await request.json()));
    })
    .post("/api/skills/requirements/:id/start-stage", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.startStage(request.params.id, await request.json()));
    })
    .post("/api/skills/requirements/:id/artifacts", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.attachArtifact(request.params.id, await request.json()), { status: 201 });
    })
    .post("/api/skills/requirements/:id/artifacts/upload", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.uploadArtifact(request.params.id, await request.json()), { status: 201 });
    })
    .post("/api/skills/requirements/:id/complete-stage", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.completeStage(request.params.id, await request.json()));
    })
    .post("/api/skills/requirements/:id/status/complete-stage", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.completeStage(request.params.id, await request.json()));
    })
    .post("/api/skills/requirements/:id/fail-stage", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.failStage(request.params.id, await request.json()));
    })
    .post("/api/skills/requirements/:id/status/fail-stage", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.failStage(request.params.id, await request.json()));
    })
    .post("/api/skills/requirements/:id/notes", async (request: IRequestStrict, env: ApiEnv) => {
      await requireSkillToken(request, env, repository);
      return jsonResponse(await service.addNote(request.params.id, await request.json()), { status: 201 });
    });
}
