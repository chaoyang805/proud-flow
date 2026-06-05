import { errorCodes, type ErrorCode } from "@proud-flow/domain";
import {
  arraySchema,
  enumSchema,
  objectSchema,
  optionalSchema,
  stringSchema,
  type Schema,
} from "./schema";

export interface ErrorDetailResponse {
  field?: string;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetailResponse[];
  };
}

export const errorDetailResponseSchema: Schema<ErrorDetailResponse> =
  objectSchema({
    field: optionalSchema(stringSchema({ minLength: 1 })),
    message: stringSchema({ minLength: 1 }),
  });

export const errorResponseSchema: Schema<ErrorResponse> = objectSchema({
  error: objectSchema({
    code: enumSchema(errorCodes),
    message: stringSchema({ minLength: 1 }),
    details: optionalSchema(arraySchema(errorDetailResponseSchema)),
  }),
});

export const emptyResponseSchema: Schema<Record<string, never>> = objectSchema(
  {},
);
