import { type IRequestStrict, Router, type RouterType } from "itty-router";
import {
  completeStageRequestSchema,
  startStageRequestSchema,
} from "@proud-flow/api-contract";
import type { ApiEnv } from "../../env";
import { requireUserToken } from "../../middleware/auth";
import { ApiError, jsonResponse } from "../../middleware/error";
import type { IRequirementRepository } from "../requirements/repository";
import { completeAiStage, startAiStage } from "./state-machine";

export function installWorkflowModule(
  router: RouterType,
  repository: IRequirementRepository,
) {
  router
    .post("/api/requirements/:id/workflow/start-stage", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      const body = startStageRequestSchema.parse(await request.json());
      const requirement = await requireRequirement(repository, request.params.id);
      const status = startAiStage(requirement, body.stage);
      const updated = await repository.updateRequirement(requirement.id, { status });
      return jsonResponse({ requirement: updated });
    })
    .post("/api/requirements/:id/workflow/complete-stage", async (request: IRequestStrict, env: ApiEnv) => {
      await requireUserToken(request, env);
      const body = completeStageRequestSchema.parse(await request.json());
      const requirement = await requireRequirement(repository, request.params.id);
      const status = completeAiStage(
        requirement,
        body.stage,
        await repository.listArtifacts(requirement.id),
      );
      const updated = await repository.updateRequirement(requirement.id, { status });
      return jsonResponse({ requirement: updated });
    });
}

async function requireRequirement(repository: IRequirementRepository, id: string) {
  const requirement = await repository.getRequirement(id);
  if (!requirement) throw new ApiError(404, "NOT_FOUND", "Requirement not found");
  return requirement;
}
