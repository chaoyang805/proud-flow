import type { ApiEnv } from "../../env";
import { requireLocalToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import { createSkillManifest } from "./skill-manifest";
import { LocalApiService } from "./service";

export async function handleLocalRoute(
  request: Request,
  pathname: string,
  env: ApiEnv,
  service: LocalApiService,
  repository: IRequirementRepository,
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
    return jsonResponse(createSkillManifest(env.SKILL_MANIFEST_BASE_URL));
  }

  return undefined;
}
