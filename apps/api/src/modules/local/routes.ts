import { type IRequestStrict, Router, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireLocalToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import { createSkillManifest } from "./skill-manifest";
import type { LocalApiService } from "./service";

export function installLocalModule(
  router: RouterType,
  service: LocalApiService,
  repository: IRequirementRepository,
  env: ApiEnv,
) {
  router
    .post("/api/local/bootstrap", async (request: IRequestStrict) => {
      const body = await service.bootstrap(await request.json(), env);
      return jsonResponse(body, { status: 201 });
    })
    .post("/api/local/tokens/rotate", async (request: IRequestStrict) => {
      await requireLocalToken(request, env, repository);
      return jsonResponse(await service.rotate(await request.json(), env));
    })
    .post("/api/local/tokens/revoke", async (request: IRequestStrict) => {
      await requireLocalToken(request, env, repository);
      return jsonResponse(service.revoke(await request.json()));
    })
    .get("/api/local/skills/manifest", () => {
      return jsonResponse(createSkillManifest(env.SKILL_MANIFEST_BASE_URL));
    });
}
