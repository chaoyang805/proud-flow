import {
  completeStageRequestSchema,
  startStageRequestSchema,
  type CompleteStageRequest,
  type StartStageRequest,
} from "@proud-flow/api-contract";
import { ApiError, jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import { completeAiStage, startAiStage } from "./state-machine";

export async function handleWorkflowRoute(
  request: Request,
  pathname: string,
  repository: IRequirementRepository,
): Promise<Response | undefined> {
  const startMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/workflow\/start-stage$/,
  );
  if (startMatch && request.method === "POST") {
    const body: StartStageRequest = startStageRequestSchema.parse(
      await request.json(),
    );
    const requirement = await requireRequirement(repository, startMatch[1]);
    const status = startAiStage(requirement, body.stage);
    const updated = await repository.updateRequirement(requirement.id, { status });
    return jsonResponse({ requirement: updated });
  }
  const completeMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/workflow\/complete-stage$/,
  );
  if (completeMatch && request.method === "POST") {
    const body: CompleteStageRequest = completeStageRequestSchema.parse(
      await request.json(),
    );
    const requirement = await requireRequirement(repository, completeMatch[1]);
    const status = completeAiStage(
      requirement,
      body.stage,
      await repository.listArtifacts(requirement.id),
    );
    const updated = await repository.updateRequirement(requirement.id, { status });
    return jsonResponse({ requirement: updated });
  }
  return undefined;
}

async function requireRequirement(
  repository: IRequirementRepository,
  id: string,
) {
  const requirement = await repository.getRequirement(id);
  if (!requirement)
    throw new ApiError(404, "NOT_FOUND", "Requirement not found");
  return requirement;
}
