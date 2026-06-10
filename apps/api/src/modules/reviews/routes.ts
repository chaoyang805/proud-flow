import { type IRequestStrict, Router, type RouterType } from "itty-router";
import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import { broadcastRequirementUpdated } from "../realtime/requirement-updated";
import type { RealtimeHub } from "../realtime/hub";
import type { ReviewsService } from "./service";

export function installReviewsModule(
  router: RouterType,
  service: ReviewsService,
  hub: RealtimeHub,
) {
  router
    .post("/api/requirements/:id/reviews/rollback", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      const requirement = await service.rollback(request.params.id, await request.json());
      void broadcastRequirementUpdated(env, hub, requirement);
      return jsonResponse({ requirement });
    })
    .post("/api/reviews/:id/rollback", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      const requirement = await service.rollback(request.params.id, await request.json());
      void broadcastRequirementUpdated(env, hub, requirement);
      return jsonResponse({ requirement });
    });
}
