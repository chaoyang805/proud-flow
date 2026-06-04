import {
  errorResponseSchema,
  type ErrorResponse,
} from "@proud-flow/api-contract";
import type { ErrorCode } from "@proud-flow/domain";

export class ProudFlowApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorResponse["error"]["details"];

  constructor(status: number, response: ErrorResponse) {
    super(response.error.message);
    this.name = "ProudFlowApiError";
    this.status = status;
    this.code = response.error.code;
    this.details = response.error.details;
  }
}

export function parseErrorResponse(
  status: number,
  value: unknown,
): ProudFlowApiError {
  if (errorResponseSchema.is(value)) {
    return new ProudFlowApiError(status, value);
  }

  return new ProudFlowApiError(status, {
    error: {
      code: "INTERNAL_ERROR",
      message: `Unexpected API error response with HTTP ${status}`,
    },
  });
}
