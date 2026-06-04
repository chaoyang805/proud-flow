import type { ApiEnv } from "../../env.js";
import { requireLocalToken } from "../../middleware/auth.js";
import { jsonResponse } from "../../middleware/error.js";
import type { InMemoryRequirementRepository } from "../requirements/repository.js";
import { createSkillManifest } from "./skill-manifest.js";
import { LocalApiService } from "./service.js";

export async function handleLocalRoute(
  request: Request,
  pathname: string,
  env: ApiEnv,
  service: LocalApiService,
  repository: InMemoryRequirementRepository,
): Promise<Response | undefined> {
  if (pathname === "/api/local/bootstrap" && request.method === "POST") {
    const body = await service.bootstrap(await request.json(), env);
    return jsonResponse(body, { status: 201 });
  }

  if (pathname === "/api/local/tokens/rotate" && request.method === "POST") {
    await requireLocalToken(request, env, repository);
    return jsonResponse(await service.rotate(await request.json(), env));
  }

  if (pathname === "/api/local/tokens/revoke" && request.method === "POST") {
    await requireLocalToken(request, env, repository);
    return jsonResponse(service.revoke(await request.json()));
  }

  if (pathname === "/api/local/skills/manifest" && request.method === "GET") {
    return jsonResponse(createSkillManifest());
  }

  return undefined;
}
