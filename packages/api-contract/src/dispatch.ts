import {
  dispatchStages,
  type DispatchAckedMessage,
  type DispatchMessage,
  type DispatchStage,
} from "@proud-flow/domain";
import {
  booleanSchema,
  enumSchema,
  numberSchema,
  objectSchema,
  optionalSchema,
  stringSchema,
  unionSchema,
  type Schema,
} from "./schema";
import { requirementIdSchema } from "./requirements";

export interface DispatchRequirementRequest {
  stage: DispatchStage;
}

export interface DispatchRequirementResponse {
  requestId: string;
  stage: DispatchStage;
  accepted: boolean;
  ack?: {
    success: boolean;
    errorMessage?: string;
  };
}

export interface DispatchDoStatusResponse {
  online: boolean;
  connectionCount: number;
}

export type DispatchPushFailureCode = "DISPATCHER_OFFLINE" | "DISPATCH_TIMEOUT";

export interface DispatchPushAckResult {
  success: boolean;
  errorMessage?: string;
}

export type DispatchPushResponse =
  | {
      accepted: true;
      requestId: string;
      ack: DispatchPushAckResult;
    }
  | {
      accepted: false;
      code: DispatchPushFailureCode;
    };

export const dispatchRequestIdSchema = stringSchema({
  pattern: /^dispatch_req_[A-Za-z0-9_-]+$/,
});

export const dispatchRequirementRequestSchema: Schema<DispatchRequirementRequest> =
  objectSchema({
    stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
  });

const dispatchPushAckResultSchema: Schema<DispatchPushAckResult> = objectSchema({
  success: booleanSchema(),
  errorMessage: optionalSchema(stringSchema({ minLength: 1 })),
});

export const dispatchRequirementResponseSchema: Schema<DispatchRequirementResponse> =
  objectSchema({
    requestId: dispatchRequestIdSchema,
    stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
    accepted: booleanSchema(),
    ack: optionalSchema(dispatchPushAckResultSchema),
  });

export const dispatchDoStatusResponseSchema: Schema<DispatchDoStatusResponse> =
  objectSchema({
    online: booleanSchema(),
    connectionCount: numberSchema({ integer: true, minimum: 0 }),
  });

function isDispatchPushResponse(value: unknown): value is DispatchPushResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.accepted === true) {
    return (
      dispatchRequestIdSchema.is(record.requestId) &&
      dispatchPushAckResultSchema.is(record.ack)
    );
  }
  if (record.accepted === false) {
    return (
      record.code === "DISPATCHER_OFFLINE" || record.code === "DISPATCH_TIMEOUT"
    );
  }
  return false;
}

export const dispatchPushResponseSchema: Schema<DispatchPushResponse> = {
  parse(value) {
    if (!isDispatchPushResponse(value)) {
      throw new Error("Value does not match dispatch push response schema");
    }
    return value;
  },
  is: isDispatchPushResponse,
  toJsonSchema() {
    return {
      anyOf: [
        objectSchema({
          accepted: booleanSchema(),
          requestId: dispatchRequestIdSchema,
          ack: dispatchPushAckResultSchema,
        }).toJsonSchema(),
        objectSchema({
          accepted: booleanSchema(),
          code: enumSchema(["DISPATCHER_OFFLINE", "DISPATCH_TIMEOUT"] as const),
        }).toJsonSchema(),
      ],
    };
  },
};

export const dispatchRequestedMessageSchema: Schema<
  Extract<DispatchMessage, { type: "dispatch.requested" }>
> = objectSchema({
  type: enumSchema(["dispatch.requested"] as const),
  requestId: dispatchRequestIdSchema,
  requirementId: requirementIdSchema,
  stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
});

export const dispatchAckedMessageSchema: Schema<DispatchAckedMessage> =
  objectSchema({
    type: enumSchema(["dispatch.acked"] as const),
    requestId: dispatchRequestIdSchema,
    success: booleanSchema(),
    errorMessage: optionalSchema(stringSchema({ minLength: 1 })),
  });

export const dispatcherPingMessageSchema: Schema<
  Extract<DispatchMessage, { type: "dispatcher.ping" }>
> = objectSchema({
  type: enumSchema(["dispatcher.ping"] as const),
  timestamp: stringSchema({ minLength: 1, format: "date-time" }),
});

export const dispatcherPongMessageSchema: Schema<
  Extract<DispatchMessage, { type: "dispatcher.pong" }>
> = objectSchema({
  type: enumSchema(["dispatcher.pong"] as const),
  timestamp: stringSchema({ minLength: 1, format: "date-time" }),
});

export const dispatchMessageSchema: Schema<DispatchMessage> =
  unionSchema<DispatchMessage>([
    dispatchRequestedMessageSchema as Schema<DispatchMessage>,
    dispatchAckedMessageSchema as Schema<DispatchMessage>,
    dispatcherPingMessageSchema as Schema<DispatchMessage>,
    dispatcherPongMessageSchema as Schema<DispatchMessage>,
  ]);
