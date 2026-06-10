import { type IRequestStrict, Router, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import { broadcastRequirementUpdated } from "../realtime/requirement-updated";
import type { RealtimeHub } from "../realtime/hub";
import type { ArtifactsService } from "./service";

export function installArtifactsModule(
  router: RouterType,
  service: ArtifactsService,
  hub: RealtimeHub,
) {
  router
    .get("/api/requirements/:id/artifacts", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse({ items: await service.list(request.params.id) });
    })
    .post("/api/requirements/:id/artifacts", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse(await service.create(request.params.id, await request.json()), { status: 201 });
    })
    .post("/api/requirements/:id/artifacts/upload", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse(await service.upload(request.params.id, await request.json()), { status: 201 });
    })
    .post("/api/requirements/:id/archive", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      const requirement = await service.archive(request.params.id);
      void broadcastRequirementUpdated(env, hub, requirement);
      return jsonResponse({ archived: true });
    });
}
