import { SchemaValidationError } from "@proud-flow/api-contract";
import type { ErrorCode } from "@proud-flow/domain";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse(
  value: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export function errorResponse(error: ApiError): Response {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status: error.status },
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof SchemaValidationError) {
    return new ApiError(400, "VALIDATION_ERROR", error.formatMessage());
  }
  if (
    error instanceof Error &&
    (error.message.startsWith("Invalid ") ||
      error.message.includes("does not match"))
  ) {
    return new ApiError(400, "VALIDATION_ERROR", error.message);
  }
  return new ApiError(
    500,
    "INTERNAL_ERROR",
    error instanceof Error ? error.message : "Internal error",
  );
}
