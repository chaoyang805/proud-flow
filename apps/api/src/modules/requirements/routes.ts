import { type IRequestStrict, Router, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { RequirementsService } from "./service";

export function installRequirementsModule(
  router: RouterType,
  service: RequirementsService,
) {
  router
    .get("/api/requirements", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse({ items: await service.list() });
    })
    .post("/api/requirements", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse(await service.create(await request.json()), { status: 201 });
    })
    .get("/api/requirements/:id", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse(await service.get(request.params.id));
    })
    .patch("/api/requirements/:id", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse(await service.update(request.params.id, await request.json()));
    });
}
