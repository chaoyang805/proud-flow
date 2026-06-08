import { type IRequestStrict, Router, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { ReviewsService } from "./service";

export function installReviewsModule(
  router: RouterType,
  service: ReviewsService,
) {
  router
    .post("/api/requirements/:id/reviews/approve", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse({ requirement: await service.approve(request.params.id) });
    })
    .post("/api/reviews/:id/approve", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse({ requirement: await service.approve(request.params.id) });
    })
    .post("/api/requirements/:id/reviews/rollback", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse({
        requirement: await service.rollback(request.params.id, await request.json()),
      });
    })
    .post("/api/reviews/:id/rollback", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      return jsonResponse({
        requirement: await service.rollback(request.params.id, await request.json()),
      });
    });
}
