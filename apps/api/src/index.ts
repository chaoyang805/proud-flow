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
import { InMemoryRequirementRepository, IRequirementRepository } from "./modules/requirements/repository";
import { RealtimeHub } from "./modules/realtime/hub";
import { D1RequirementRepository } from "./modules/requirements/d1-repository";
import { RequirementsService } from "./modules/requirements/service";
import { handleRequirementsRoute } from "./modules/requirements/routes";
import { handleRealtimeRoute } from "./modules/realtime/routes";
import { ReviewsService } from "./modules/reviews/service";
import { handleReviewsRoute } from "./modules/reviews/routes";
import { SkillsApiService } from "./modules/skills/service";
import { handleSkillsRoute } from "./modules/skills/routes";
import { handleWorkflowRoute } from "./modules/workflow/routes";

export interface ApiAppOptions {
  repository?: IRequirementRepository;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function withCors(response: Response): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders())) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createApiApp(options: ApiAppOptions = {}) {
  function buildRepository(env: ApiEnv): IRequirementRepository {
    if (options.repository) return options.repository;
    const db = (env as any).DB;
    if (db) {
      console.log("[api] using D1RequirementRepository (D1 available)");
      return new D1RequirementRepository(db);
    }
    console.log("[api] using InMemoryRequirementRepository (no D1)");
    return new InMemoryRequirementRepository();
  }

  let repository: IRequirementRepository | undefined;
  const hub = new RealtimeHub();

  return {
    hub,
    get repository(): IRequirementRepository {
      if (!repository) {
        console.log("[api] repository accessed before fetch, using InMemory fallback");
        repository = new InMemoryRequirementRepository();
      }
      return repository;
    },
    async fetch(request: Request, env: ApiEnv = {}): Promise<Response> {
      if (!repository) repository = buildRepository(env);
      const url = new URL(request.url);
      const start = Date.now();
      console.log(`[api] --> ${request.method} ${url.pathname}${url.search ? url.search : ""}`);
      if (request.method === "OPTIONS") {
        console.log(`[api] <-- 204 OPTIONS (${Date.now() - start}ms)`);
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      try {
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
          (await handleDispatchRoute(request, url.pathname, env, repository, hub)) ??
          (await handleRealtimeRoute(request, url.pathname, env, hub)) ??
          (await requireUserToken(request, env).then(() => undefined)) ??
          (await handleRequirementsRoute(
            request,
            url.pathname,
            requirements,
          )) ??
          (await handleReviewsRoute(request, url.pathname, reviews)) ??
          (await handleArtifactsRoute(request, url.pathname, artifacts)) ??
          (await handleWorkflowRoute(request, url.pathname, repository));

        if (response) {
          console.log(`[api] <-- ${response.status} ${request.method} ${url.pathname} (${Date.now() - start}ms)`);
          return withCors(response);
        }
        console.log(`[api] <-- 404 ${request.method} ${url.pathname} (${Date.now() - start}ms)`);
        return withCors(errorResponse(new ApiError(404, "NOT_FOUND", "Route not found")));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[api] ERROR: ${msg}`, error instanceof Error ? error.stack : '');
        const status = error instanceof ApiError ? error.status : 500;
        console.log(`[api] <-- ${status} ${request.method} ${url.pathname} (${Date.now() - start}ms)`);
        return withCors(errorResponse(toApiError(error)));
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
