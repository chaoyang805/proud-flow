import {
  artifactListResponseSchema,
  artifactResponseSchema,
  createArtifactRequestSchema,
  uploadArtifactRequestSchema,
  type ArtifactListResponse,
  type ArtifactResponse,
  type CreateArtifactRequest,
  type UploadArtifactRequest,
} from "@proud-flow/api-contract";
import type { ProudFlowHttpClient } from "./client.js";

export class ArtifactsApiClient {
  constructor(private readonly http: ProudFlowHttpClient) {}

  list(requirementId: string): Promise<ArtifactListResponse> {
    return this.http.request({
      method: "GET",
      path: `/api/requirements/${requirementId}/artifacts`,
      responseSchema: artifactListResponseSchema,
    });
  }

  create(
    requirementId: string,
    body: CreateArtifactRequest,
  ): Promise<ArtifactResponse> {
    return this.http.request({
      method: "POST",
      path: `/api/requirements/${requirementId}/artifacts`,
      requestSchema: createArtifactRequestSchema,
      responseSchema: artifactResponseSchema,
      body,
    });
  }

  upload(body: UploadArtifactRequest): Promise<ArtifactResponse> {
    return this.http.request({
      method: "POST",
      path: "/api/artifacts/upload",
      requestSchema: uploadArtifactRequestSchema,
      responseSchema: artifactResponseSchema,
      body,
    });
  }
}
