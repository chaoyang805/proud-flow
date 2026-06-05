import {
  artifactTypes,
  dispatchStages,
  type ArtifactType,
  type DispatchStage,
} from "@proud-flow/domain";
import {
  arraySchema,
  enumSchema,
  objectSchema,
  optionalSchema,
  stringSchema,
  type Schema,
} from "./schema";
import {
  artifactListResponseSchema,
  artifactResponseSchema,
  createArtifactRequestSchema,
  uploadArtifactRequestSchema,
  type ArtifactListResponse,
  type ArtifactResponse,
  type CreateArtifactRequest,
  type UploadArtifactRequest,
} from "./artifacts";
import {
  requirementResponseSchema,
  type RequirementResponse,
} from "./requirements";

export interface TaskContextResponse {
  requirement: RequirementResponse;
  currentArtifacts: ArtifactListResponse;
  historicalArtifacts: ArtifactListResponse;
  requiredArtifactTypes: ArtifactType[];
  allowedActions: string[];
  rollbackReason?: string;
}

export interface StartStageRequest {
  stage: DispatchStage;
}

export interface CompleteStageRequest {
  stage: DispatchStage;
}

export interface FailStageRequest {
  stage: DispatchStage;
  message: string;
}

export interface AddNoteRequest {
  message: string;
}

export interface StageActionResponse {
  requirement: RequirementResponse;
}

export type SkillCreateArtifactRequest = CreateArtifactRequest;
export type SkillUploadArtifactRequest = UploadArtifactRequest;
export type SkillArtifactResponse = ArtifactResponse;

export const taskContextResponseSchema: Schema<TaskContextResponse> =
  objectSchema({
    requirement: requirementResponseSchema,
    currentArtifacts: artifactListResponseSchema,
    historicalArtifacts: artifactListResponseSchema,
    requiredArtifactTypes: arraySchema(
      enumSchema(artifactTypes) as Schema<ArtifactType>,
    ),
    allowedActions: arraySchema(stringSchema({ minLength: 1 })),
    rollbackReason: optionalSchema(stringSchema({ minLength: 1 })),
  });

export const startStageRequestSchema: Schema<StartStageRequest> = objectSchema({
  stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
});

export const completeStageRequestSchema: Schema<CompleteStageRequest> =
  objectSchema({
    stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
  });

export const failStageRequestSchema: Schema<FailStageRequest> = objectSchema({
  stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
  message: stringSchema({ minLength: 1 }),
});

export const addNoteRequestSchema: Schema<AddNoteRequest> = objectSchema({
  message: stringSchema({ minLength: 1 }),
});

export const stageActionResponseSchema: Schema<StageActionResponse> =
  objectSchema({
    requirement: requirementResponseSchema,
  });

export const skillCreateArtifactRequestSchema = createArtifactRequestSchema;
export const skillUploadArtifactRequestSchema = uploadArtifactRequestSchema;
export const skillArtifactResponseSchema = artifactResponseSchema;
