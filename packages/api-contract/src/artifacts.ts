import {
  artifactTypes,
  type Artifact,
  type ArtifactType,
} from "@proud-flow/domain";
import {
  arraySchema,
  enumSchema,
  numberSchema,
  objectSchema,
  optionalSchema,
  stringSchema,
  type Schema,
} from "./schema";
import { requirementIdSchema } from "./requirements";

export interface ArtifactResponse extends Artifact {}

export interface ArtifactListResponse {
  items: ArtifactResponse[];
}

export interface CreateArtifactRequest {
  type: ArtifactType;
  title: string;
  url?: string;
  content?: string;
}

export interface UploadArtifactRequest {
  type: ArtifactType;
  title: string;
  fileName: string;
  contentType: string;
  contentBase64: string;
}

export const artifactIdSchema = stringSchema({
  pattern: /^art_[A-Za-z0-9_-]+$/,
});

export const artifactResponseSchema: Schema<ArtifactResponse> = objectSchema({
  id: artifactIdSchema,
  requirementId: requirementIdSchema,
  requirementVersion: numberSchema({ integer: true, minimum: 1 }),
  type: enumSchema(artifactTypes) as Schema<ArtifactType>,
  title: stringSchema({ minLength: 1 }),
  url: optionalSchema(stringSchema({ minLength: 1 })),
  content: optionalSchema(stringSchema({ minLength: 1 })),
  createdAt: stringSchema({ minLength: 1, format: "date-time" }),
});

export const artifactListResponseSchema: Schema<ArtifactListResponse> =
  objectSchema({
    items: arraySchema(artifactResponseSchema),
  });

export const createArtifactRequestSchema: Schema<CreateArtifactRequest> =
  objectSchema({
    type: enumSchema(artifactTypes) as Schema<ArtifactType>,
    title: stringSchema({ minLength: 1 }),
    url: optionalSchema(stringSchema({ minLength: 1 })),
    content: optionalSchema(stringSchema({ minLength: 1 })),
  });

export const uploadArtifactRequestSchema: Schema<UploadArtifactRequest> =
  objectSchema({
    type: enumSchema(artifactTypes) as Schema<ArtifactType>,
    title: stringSchema({ minLength: 1 }),
    fileName: stringSchema({ minLength: 1 }),
    contentType: stringSchema({ minLength: 1 }),
    contentBase64: stringSchema({ minLength: 1 }),
  });
