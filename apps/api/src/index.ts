import type { ApiEnv } from "./env";
import { requireUserToken } from "./middleware/auth";
import {
  ApiError,
  errorResponse,
  jsonResponse,
  toApiError,
} from "./middleware/error";
import { ArtifactStorage } from "./modules/artifacts/storage";
import { ArtifactsService } from "./modules/artifacts/service";
import { handleArtifactsRoute } from "./modules/artifacts/routes";
import { handleDispatchRoute } from "./modules/dispatch/routes";
import { LocalApiService } from "./modules/local/service";
import { handleLocalRoute } from "./modules/local/routes";
import { InMemoryRequirementRepository } from "./modules/requirements/repository";
import { RequirementsService } from "./modules/requirements/service";
import { handleRequirementsRoute } from "./modules/requirements/routes";
import { handleRealtimeRoute } from "./modules/realtime/routes";
import { ReviewsService } from "./modules/reviews/service";
import { handleReviewsRoute } from "./modules/reviews/routes";
import { SkillsApiService } from "./modules/skills/service";
import { handleSkillsRoute } from "./modules/skills/routes";
import { handleWorkflowRoute } from "./modules/workflow/routes";

export interface ApiAppOptions {
  repository?: InMemoryRequirementRepository;
}

export function createApiApp(options: ApiAppOptions = {}) {
  const repository = options.repository ?? new InMemoryRequirementRepository();

  return {
    repository,
    async fetch(request: Request, env: ApiEnv = {}): Promise<Response> {
      try {
        const url = new URL(request.url);
        const requirements = new RequirementsService(repository);
        const reviews = new ReviewsService(repository);
        const artifacts = new ArtifactsService(
          repository,
          new ArtifactStorage(env.ARTIFACT_BUCKET),
        );
        const local = new LocalApiService(repository);
        const skills = new SkillsApiService(repository, artifacts);

        const response =
          (await handleLocalRoute(request, url.pathname, env, local, repository)) ??
          (await handleSkillsRoute(
            request,
            url.pathname,
            env,
            skills,
            repository,
          )) ??
          (await handleDispatchRoute(request, url.pathname, env, repository)) ??
          (await handleRealtimeRoute(request, url.pathname, env, repository)) ??
          (await requireUserToken(request, env).then(() => undefined)) ??
          (await handleRequirementsRoute(
            request,
            url.pathname,
            requirements,
          )) ??
          (await handleReviewsRoute(request, url.pathname, reviews)) ??
          (await handleArtifactsRoute(request, url.pathname, artifacts)) ??
          (await handleWorkflowRoute(request, url.pathname, repository));

        if (response) return response;
        return errorResponse(new ApiError(404, "NOT_FOUND", "Route not found"));
      } catch (error) {
        return errorResponse(toApiError(error));
      }
    },
  };
}

const defaultApp = createApiApp();

export default {
  fetch: defaultApp.fetch,
};

export class DispatchDurableObject {
  fetch(): Response {
    return new Response("Dispatch Durable Object is configured for deployment", {
      status: 501,
    });
  }
}

export class RealtimeDurableObject {
  fetch(): Response {
    return new Response("Realtime Durable Object is configured for deployment", {
      status: 501,
    });
  }
}

export { hashToken, verifyTokenHash } from "./modules/auth/token-service";
export { InMemoryRequirementRepository } from "./modules/requirements/repository";
export { schemaSql } from "./db/schema";
export { jsonResponse };
