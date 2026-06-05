import {
  dispatchStages,
  type DispatchAckedMessage,
  type DispatchMessage,
  type DispatchStage,
} from "@proud-flow/domain";
import {
  booleanSchema,
  enumSchema,
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
}

export const dispatchRequestIdSchema = stringSchema({
  pattern: /^dispatch_req_[A-Za-z0-9_-]+$/,
});

export const dispatchRequirementRequestSchema: Schema<DispatchRequirementRequest> =
  objectSchema({
    stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
  });

export const dispatchRequirementResponseSchema: Schema<DispatchRequirementResponse> =
  objectSchema({
    requestId: dispatchRequestIdSchema,
    stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
    accepted: booleanSchema(),
  });

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
