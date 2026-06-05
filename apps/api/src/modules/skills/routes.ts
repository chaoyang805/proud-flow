import type { ApiEnv } from "../../env";
import { requireSkillToken } from "../../middleware/auth";
import { jsonResponse } from "../../middleware/error";
import type { InMemoryRequirementRepository } from "../requirements/repository";
import type { SkillsApiService } from "./service";

export async function handleSkillsRoute(
  request: Request,
  pathname: string,
  env: ApiEnv,
  service: SkillsApiService,
  repository: InMemoryRequirementRepository,
): Promise<Response | undefined> {
  const match = pathname.match(/^\/api\/skills\/requirements\/(REQ-\d{6})(.*)$/);
  if (!match) return undefined;

  await requireSkillToken(request, env, repository);

  const requirementId = match[1];
  const suffix = match[2] || "";

  if (suffix === "" && request.method === "GET") {
    return jsonResponse(service.getRequirement(requirementId));
  }

  if (suffix === "/task-context" && request.method === "GET") {
    return jsonResponse(service.getTaskContext(requirementId));
  }

  if (suffix === "/status/start" && request.method === "POST") {
    return jsonResponse(
      service.startStage(requirementId, await request.json()),
    );
  }

  if (suffix === "/artifacts" && request.method === "POST") {
    return jsonResponse(
      service.attachArtifact(requirementId, await request.json()),
      { status: 201 },
    );
  }

  if (suffix === "/artifacts/upload" && request.method === "POST") {
    return jsonResponse(
      await service.uploadArtifact(requirementId, await request.json()),
      { status: 201 },
    );
  }

  if (suffix === "/complete-stage" && request.method === "POST") {
    return jsonResponse(
      service.completeStage(requirementId, await request.json()),
    );
  }

  if (suffix === "/fail-stage" && request.method === "POST") {
    return jsonResponse(service.failStage(requirementId, await request.json()));
  }

  if (suffix === "/notes" && request.method === "POST") {
    return jsonResponse(service.addNote(requirementId, await request.json()), {
      status: 201,
    });
  }

  return undefined;
}
