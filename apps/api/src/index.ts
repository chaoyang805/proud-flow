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
import { DispatchDurableObject } from "./durable-objects/dispatch-do";
import { RealtimeDurableObject } from "./durable-objects/realtime-do";
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
  let repository: IRequirementRepository | undefined;
  let repositoryBootstrap: Promise<IRequirementRepository> | undefined;
  let router: RouterType | undefined;
  let cachedArtifactBucket: ApiEnv["ARTIFACT_BUCKET"];
  const hub = new RealtimeHub();

  async function bootstrapRepository(env: ApiEnv): Promise<IRequirementRepository> {
    if (options.repository) {
      repository = options.repository;
      return repository;
    }
    if (repository) return repository;
    if (repositoryBootstrap) return repositoryBootstrap;

    repositoryBootstrap = (async () => {
      const db = (env as { DB?: ConstructorParameters<typeof D1RequirementRepository>[0] }).DB;
      if (db) {
        console.log("[api] bootstrapping D1RequirementRepository...");
        const repo = new D1RequirementRepository(db);
        await repo.start();
        repository = repo;
        return repo;
      }
      console.log("[api] bootstrapping InMemoryRequirementRepository");
      repository = new InMemoryRequirementRepository();
      return repository;
    })();

    return repositoryBootstrap;
  }

  function getRouter(env: ApiEnv): RouterType {
    if (router && cachedArtifactBucket === env.ARTIFACT_BUCKET) return router;
    if (!repository) {
      throw new Error("Repository must be bootstrapped before building router");
    }

    const requirements = new RequirementsService(repository);
    const reviews = new ReviewsService(repository);
    const artifacts = new ArtifactsService(repository, new ArtifactStorage(env.ARTIFACT_BUCKET));
    const local = new LocalApiService(repository);
    const skills = new SkillsApiService(repository, artifacts);

    cachedArtifactBucket = env.ARTIFACT_BUCKET;
    router = Router();

    // OPTIONS preflight
    router.options("*", () => new Response(null, { status: 204, headers: corsHeaders() }));

    router.get("/api/health", () => Response.json({ status: "ok" }));

    // Register all modules (each module handles its own auth)
    installLocalModule(router, local, repository);
    installDispatchModule(router, repository, hub);
    installRealtimeModule(router, hub);
    installSkillsModule(router, skills, repository, hub);
    installRequirementsModule(router, requirements);
    installReviewsModule(router, reviews, hub);
    installArtifactsModule(router, artifacts, hub);
    installWorkflowModule(router, repository, hub);

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
        await bootstrapRepository(env);
        const response = await getRouter(env).fetch(request, env);
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

export default {
  fetch: defaultApp.fetch,
};

export { DispatchDurableObject, RealtimeDurableObject };
