import {
  createRequirementRequestSchema,
  requirementListResponseSchema,
  requirementResponseSchema,
  updateRequirementRequestSchema,
  type CreateRequirementRequest,
  type RequirementListResponse,
  type RequirementResponse,
  type UpdateRequirementRequest,
} from "@proud-flow/api-contract";
import type { ProudFlowHttpClient } from "./client";

export class RequirementsApiClient {
  constructor(private readonly http: ProudFlowHttpClient) {}

  create(body: CreateRequirementRequest): Promise<RequirementResponse> {
    return this.http.request({
      method: "POST",
      path: "/api/requirements",
      requestSchema: createRequirementRequestSchema,
      responseSchema: requirementResponseSchema,
      body,
    });
  }

  list(): Promise<RequirementListResponse> {
    return this.http.request({
      method: "GET",
      path: "/api/requirements",
      responseSchema: requirementListResponseSchema,
    });
  }

  get(id: string): Promise<RequirementResponse> {
    return this.http.request({
      method: "GET",
      path: `/api/requirements/${id}`,
      responseSchema: requirementResponseSchema,
    });
  }

  update(
    id: string,
    body: UpdateRequirementRequest,
  ): Promise<RequirementResponse> {
    return this.http.request({
      method: "PATCH",
      path: `/api/requirements/${id}`,
      requestSchema: updateRequirementRequestSchema,
      responseSchema: requirementResponseSchema,
      body,
    });
  }

  archive(id: string): Promise<Record<string, never>> {
    return this.http.request({
      method: "POST",
      path: `/api/requirements/${id}/archive`,
    });
  }
}
