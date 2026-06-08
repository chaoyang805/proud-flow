export const errorCodes = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "INVALID_STATUS_TRANSITION",
  "MISSING_REQUIRED_ARTIFACT",
  "DISPATCHER_OFFLINE",
  "DISPATCH_TIMEOUT",
  "TOKEN_EXPIRED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface DomainErrorDetail {
  field?: string;
  message: string;
}

export function isErrorCode(value: string): value is ErrorCode {
  return errorCodes.includes(value as ErrorCode);
}
