import {
  artifactListResponseSchema,
  artifactResponseSchema,
  createArtifactRequestSchema,
  uploadArtifactRequestSchema,
} from "./artifacts.js";
import {
  dispatchRequirementRequestSchema,
  dispatchRequirementResponseSchema,
} from "./dispatch.js";
import {
  localBootstrapRequestSchema,
  localBootstrapResponseSchema,
  rotateTokenRequestSchema,
  rotateTokenResponseSchema,
  revokeTokenRequestSchema,
  skillManifestResponseSchema,
} from "./local.js";
import {
  createRequirementRequestSchema,
  requirementListResponseSchema,
  requirementResponseSchema,
  updateRequirementRequestSchema,
} from "./requirements.js";
import {
  approveReviewRequestSchema,
  reviewActionResponseSchema,
  rollbackReviewRequestSchema,
} from "./reviews.js";
import {
  addNoteRequestSchema,
  completeStageRequestSchema,
  failStageRequestSchema,
  skillArtifactResponseSchema,
  skillCreateArtifactRequestSchema,
  skillUploadArtifactRequestSchema,
  stageActionResponseSchema,
  startStageRequestSchema,
  taskContextResponseSchema,
} from "./skills.js";
import type { JsonSchema, Schema } from "./schema.js";

type Method = "get" | "post" | "patch" | "delete";

interface RouteSpec {
  method: Method;
  path: string;
  summary: string;
  request?: Schema<unknown>;
  response?: Schema<unknown>;
}

export const routeSpecs: RouteSpec[] = [
  {
    method: "post",
    path: "/api/requirements",
    summary: "Create requirement",
    request: createRequirementRequestSchema,
    response: requirementResponseSchema,
  },
  {
    method: "get",
    path: "/api/requirements",
    summary: "List requirements",
    response: requirementListResponseSchema,
  },
  {
    method: "get",
    path: "/api/requirements/{id}",
    summary: "Get requirement",
    response: requirementResponseSchema,
  },
  {
    method: "patch",
    path: "/api/requirements/{id}",
    summary: "Update requirement",
    request: updateRequirementRequestSchema,
    response: requirementResponseSchema,
  },
  {
    method: "post",
    path: "/api/requirements/{id}/reviews/approve",
    summary: "Approve review",
    request: approveReviewRequestSchema,
    response: reviewActionResponseSchema,
  },
  {
    method: "post",
    path: "/api/requirements/{id}/reviews/rollback",
    summary: "Rollback review",
    request: rollbackReviewRequestSchema,
    response: reviewActionResponseSchema,
  },
  {
    method: "post",
    path: "/api/requirements/{id}/dispatch",
    summary: "Dispatch requirement",
    request: dispatchRequirementRequestSchema,
    response: dispatchRequirementResponseSchema,
  },
  {
    method: "get",
    path: "/api/requirements/{id}/artifacts",
    summary: "List artifacts",
    response: artifactListResponseSchema,
  },
  {
    method: "post",
    path: "/api/requirements/{id}/artifacts",
    summary: "Create artifact",
    request: createArtifactRequestSchema,
    response: artifactResponseSchema,
  },
  {
    method: "post",
    path: "/api/artifacts/upload",
    summary: "Upload artifact",
    request: uploadArtifactRequestSchema,
    response: artifactResponseSchema,
  },
  {
    method: "get",
    path: "/api/skills/requirements/{id}",
    summary: "Get skill requirement",
    response: requirementResponseSchema,
  },
  {
    method: "get",
    path: "/api/skills/requirements/{id}/task-context",
    summary: "Get skill task context",
    response: taskContextResponseSchema,
  },
  {
    method: "post",
    path: "/api/skills/requirements/{id}/status/start",
    summary: "Start skill stage",
    request: startStageRequestSchema,
    response: stageActionResponseSchema,
  },
  {
    method: "post",
    path: "/api/skills/requirements/{id}/artifacts",
    summary: "Create skill artifact",
    request: skillCreateArtifactRequestSchema,
    response: skillArtifactResponseSchema,
  },
  {
    method: "post",
    path: "/api/skills/requirements/{id}/artifacts/upload",
    summary: "Upload skill artifact",
    request: skillUploadArtifactRequestSchema,
    response: skillArtifactResponseSchema,
  },
  {
    method: "post",
    path: "/api/skills/requirements/{id}/complete-stage",
    summary: "Complete skill stage",
    request: completeStageRequestSchema,
    response: stageActionResponseSchema,
  },
  {
    method: "post",
    path: "/api/skills/requirements/{id}/fail-stage",
    summary: "Fail skill stage",
    request: failStageRequestSchema,
    response: stageActionResponseSchema,
  },
  {
    method: "post",
    path: "/api/skills/requirements/{id}/notes",
    summary: "Add skill note",
    request: addNoteRequestSchema,
    response: stageActionResponseSchema,
  },
  {
    method: "post",
    path: "/api/local/bootstrap",
    summary: "Bootstrap local CLI",
    request: localBootstrapRequestSchema,
    response: localBootstrapResponseSchema,
  },
  {
    method: "post",
    path: "/api/local/tokens/rotate",
    summary: "Rotate local token",
    request: rotateTokenRequestSchema,
    response: rotateTokenResponseSchema,
  },
  {
    method: "post",
    path: "/api/local/tokens/revoke",
    summary: "Revoke local token",
    request: revokeTokenRequestSchema,
  },
  {
    method: "get",
    path: "/api/local/skills/manifest",
    summary: "Get skill manifest",
    response: skillManifestResponseSchema,
  },
];

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
}

export function createOpenApiDocument(): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};

  for (const route of routeSpecs) {
    paths[route.path] ??= {};
    paths[route.path][route.method] = {
      summary: route.summary,
      ...(route.request
        ? { requestBody: jsonRequestBody(route.request.toJsonSchema()) }
        : {}),
      responses: {
        "200": {
          description: "OK",
          ...(route.response
            ? { content: jsonContent(route.response.toJsonSchema()) }
            : {}),
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: { title: "Proud Flow API", version: "0.1.0" },
    paths,
  };
}

function jsonRequestBody(schema: JsonSchema): Record<string, unknown> {
  return { required: true, content: jsonContent(schema) };
}

function jsonContent(schema: JsonSchema): Record<string, unknown> {
  return { "application/json": { schema } };
}

export const openApiDocument = createOpenApiDocument();
