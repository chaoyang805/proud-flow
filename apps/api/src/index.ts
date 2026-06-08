import { Router, type RouterType } from "itty-router";
import type { ApiEnv } from "./env";
import { ApiError, errorResponse, toApiError } from "./middleware/error";
import { ArtifactStorage } from "./modules/artifacts/storage";
import { ArtifactsService } from "./modules/artifacts/service";
import { installArtifactsModule } from "./modules/artifacts/routes";
import { installDispatchModule } from "./modules/dispatch/routes";
import { installLocalModule } from "./modules/local/routes";
import { LocalApiService } from "./modules/local/service";
import { InMemoryRequirementRepository, IRequirementRepository } from "./modules/requirements/repository";
import { D1RequirementRepository } from "./modules/requirements/d1-repository";
import { RequirementsService } from "./modules/requirements/service";
import { installRequirementsModule } from "./modules/requirements/routes";
import { installRealtimeModule } from "./modules/realtime/routes";
import { RealtimeHub } from "./modules/realtime/hub";
import { ReviewsService } from "./modules/reviews/service";
import { installReviewsModule } from "./modules/reviews/routes";
import { SkillsApiService } from "./modules/skills/service";
import { installSkillsModule } from "./modules/skills/routes";
import { installWorkflowModule } from "./modules/workflow/routes";

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
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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

  function buildRouter(env: ApiEnv): RouterType {
    if (!repository) repository = buildRepository(env);

    const requirements = new RequirementsService(repository);
    const reviews = new ReviewsService(repository);
    const artifacts = new ArtifactsService(repository, new ArtifactStorage(env.ARTIFACT_BUCKET));
    const local = new LocalApiService(repository);
    const skills = new SkillsApiService(repository, artifacts);

    const router = Router();

    // OPTIONS preflight
    router.options("*", () => new Response(null, { status: 204, headers: corsHeaders() }));

    // Register all modules (each module handles its own auth)
    installLocalModule(router, local, repository, env);
    installDispatchModule(router, repository, hub);
    installRealtimeModule(router, hub);
    installSkillsModule(router, skills, repository);
    installRequirementsModule(router, requirements);
    installReviewsModule(router, reviews);
    installArtifactsModule(router, artifacts);
    installWorkflowModule(router, repository);

    // 404
    router.all("*", () => errorResponse(new ApiError(404, "NOT_FOUND", "Route not found")));

    return router;
  }

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
      const url = new URL(request.url);
      const start = Date.now();
      console.log(`[api] --> ${request.method} ${url.pathname}${url.search || ""}`);

      try {
        const router = buildRouter(env);
        const response = await router.fetch(request, env);
        console.log(`[api] <-- ${response.status} ${request.method} ${url.pathname} (${Date.now() - start}ms)`);
        return withCors(response);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[api] ERROR: ${msg}`);
        const status = error instanceof ApiError ? error.status : 500;
        console.log(`[api] <-- ${status} ${request.method} ${url.pathname} (${Date.now() - start}ms)`);
        return withCors(errorResponse(toApiError(error)));
      }
    },
  };
}

const defaultApp = createApiApp();

export default { fetch: defaultApp.fetch };

export class DispatchDurableObject {
  fetch(): Response {
    return new Response("Dispatch Durable Object is configured for deployment", { status: 501 });
  }
}

export class RealtimeDurableObject {
  fetch(): Response {
    return new Response("Realtime Durable Object is configured for deployment", { status: 501 });
  }
}
