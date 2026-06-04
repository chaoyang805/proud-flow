import type { ApiEnv } from "./env.js";
import { requireUserToken } from "./middleware/auth.js";
import {
  ApiError,
  errorResponse,
  jsonResponse,
  toApiError,
} from "./middleware/error.js";
import { ArtifactStorage } from "./modules/artifacts/storage.js";
import { ArtifactsService } from "./modules/artifacts/service.js";
import { handleArtifactsRoute } from "./modules/artifacts/routes.js";
import { LocalApiService } from "./modules/local/service.js";
import { handleLocalRoute } from "./modules/local/routes.js";
import { InMemoryRequirementRepository } from "./modules/requirements/repository.js";
import { RequirementsService } from "./modules/requirements/service.js";
import { handleRequirementsRoute } from "./modules/requirements/routes.js";
import { ReviewsService } from "./modules/reviews/service.js";
import { handleReviewsRoute } from "./modules/reviews/routes.js";
import { SkillsApiService } from "./modules/skills/service.js";
import { handleSkillsRoute } from "./modules/skills/routes.js";
import { handleWorkflowRoute } from "./modules/workflow/routes.js";

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

export { hashToken, verifyTokenHash } from "./modules/auth/token-service.js";
export { InMemoryRequirementRepository } from "./modules/requirements/repository.js";
export { schemaSql } from "./db/schema.js";
export { jsonResponse };
