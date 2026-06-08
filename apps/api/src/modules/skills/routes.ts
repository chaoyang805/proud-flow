import type { ApiEnv } from "../../env";
import { requireSkillToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import type { SkillsApiService } from "./service";

export async function handleSkillsRoute(
  request: Request,
  pathname: string,
  env: ApiEnv,
  service: SkillsApiService,
  repository: IRequirementRepository,
): Promise<Response | undefined> {
  const match = pathname.match(/^\/api\/skills\/requirements\/(REQ-\d{6})(.*)$/);
  if (!match) return undefined;

  await requireSkillToken(request, env, repository);

  const requirementId = match[1];
  const suffix = match[2] || "";

  if (suffix === "" && request.method === "GET") {
    return jsonResponse(await service.getRequirement(requirementId));
  }

  if (suffix === "/task-context" && request.method === "GET") {
    return jsonResponse(await service.getTaskContext(requirementId));
  }

  if ((suffix === "/status/start" || suffix === "/start-stage") && request.method === "POST") {
    return jsonResponse(
      await service.startStage(requirementId, await request.json()),
    );
  }

  if (suffix === "/artifacts" && request.method === "POST") {
    return jsonResponse(
      await service.attachArtifact(requirementId, await request.json()),
      { status: 201 },
    );
  }

  if (suffix === "/artifacts/upload" && request.method === "POST") {
    return jsonResponse(
      await service.uploadArtifact(requirementId, await request.json()),
      { status: 201 },
    );
  }

  if ((suffix === "/complete-stage" || suffix === "/status/complete-stage") && request.method === "POST") {
    return jsonResponse(
      await service.completeStage(requirementId, await request.json()),
    );
  }

  if ((suffix === "/fail-stage" || suffix === "/status/fail-stage") && request.method === "POST") {
    return jsonResponse(await service.failStage(requirementId, await request.json()));
  }

  if (suffix === "/notes" && request.method === "POST") {
    return jsonResponse(await service.addNote(requirementId, await request.json()), {
      status: 201,
    });
  }

  return undefined;
}
