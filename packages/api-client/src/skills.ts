import {
  addNoteRequestSchema,
  completeStageRequestSchema,
  failStageRequestSchema,
  requirementResponseSchema,
  skillArtifactResponseSchema,
  skillCreateArtifactRequestSchema,
  skillUploadArtifactRequestSchema,
  stageActionResponseSchema,
  startStageRequestSchema,
  taskContextResponseSchema,
  type AddNoteRequest,
  type CompleteStageRequest,
  type FailStageRequest,
  type RequirementResponse,
  type SkillArtifactResponse,
  type SkillCreateArtifactRequest,
  type SkillUploadArtifactRequest,
  type StageActionResponse,
  type StartStageRequest,
  type TaskContextResponse,
} from "@proud-flow/api-contract";
import type { ProudFlowHttpClient } from "./client";

export class SkillsApiClient {
  constructor(private readonly http: ProudFlowHttpClient) {}

  getRequirement(id: string): Promise<RequirementResponse> {
    return this.http.request({
      method: "GET",
      path: `/api/skills/requirements/${id}`,
      responseSchema: requirementResponseSchema,
    });
  }

  getTaskContext(id: string): Promise<TaskContextResponse> {
    return this.http.request({
      method: "GET",
      path: `/api/skills/requirements/${id}/task-context`,
      responseSchema: taskContextResponseSchema,
    });
  }

  startStage(
    id: string,
    body: StartStageRequest,
  ): Promise<StageActionResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/skills/requirements/${id}/status/start`,
      requestSchema: startStageRequestSchema,
      responseSchema: stageActionResponseSchema,
      body,
    });
  }

  attachArtifact(
    id: string,
    body: SkillCreateArtifactRequest,
  ): Promise<SkillArtifactResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/skills/requirements/${id}/artifacts`,
      requestSchema: skillCreateArtifactRequestSchema,
      responseSchema: skillArtifactResponseSchema,
      body,
    });
  }

  uploadArtifact(
    id: string,
    body: SkillUploadArtifactRequest,
  ): Promise<SkillArtifactResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/skills/requirements/${id}/artifacts/upload`,
      requestSchema: skillUploadArtifactRequestSchema,
      responseSchema: skillArtifactResponseSchema,
      body,
    });
  }

  completeStage(
    id: string,
    body: CompleteStageRequest,
  ): Promise<StageActionResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/skills/requirements/${id}/complete-stage`,
      requestSchema: completeStageRequestSchema,
      responseSchema: stageActionResponseSchema,
      body,
    });
  }

  failStage(id: string, body: FailStageRequest): Promise<StageActionResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/skills/requirements/${id}/fail-stage`,
      requestSchema: failStageRequestSchema,
      responseSchema: stageActionResponseSchema,
      body,
    });
  }

  addNote(id: string, body: AddNoteRequest): Promise<StageActionResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/skills/requirements/${id}/notes`,
      requestSchema: addNoteRequestSchema,
      responseSchema: stageActionResponseSchema,
      body,
    });
  }
}
