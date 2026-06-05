import {
  dispatchStages,
  requirementStatuses,
  type DispatchStage,
  type RealtimeEvent,
  type RequirementStatus,
} from "@proud-flow/domain";
import {
  booleanSchema,
  enumSchema,
  objectSchema,
  stringSchema,
  unionSchema,
  type Schema,
} from "./schema";
import { requirementIdSchema } from "./requirements";

export const eventIdSchema = stringSchema({ pattern: /^evt_[A-Za-z0-9_-]+$/ });

export const requirementUpdatedEventSchema: Schema<
  Extract<RealtimeEvent, { type: "requirement.updated" }>
> = objectSchema({
  type: enumSchema(["requirement.updated"] as const),
  eventId: eventIdSchema,
  requirementId: requirementIdSchema,
  status: enumSchema(requirementStatuses) as Schema<RequirementStatus>,
  message: stringSchema({ minLength: 1 }),
});

export const realtimeDispatchAckedEventSchema: Schema<
  Extract<RealtimeEvent, { type: "dispatch.acked" }>
> = objectSchema({
  type: enumSchema(["dispatch.acked"] as const),
  eventId: eventIdSchema,
  requirementId: requirementIdSchema,
  success: booleanSchema(),
  message: stringSchema({ minLength: 1 }),
});

export const aiStageFailedEventSchema: Schema<
  Extract<RealtimeEvent, { type: "ai_stage.failed" }>
> = objectSchema({
  type: enumSchema(["ai_stage.failed"] as const),
  eventId: eventIdSchema,
  requirementId: requirementIdSchema,
  stage: enumSchema(dispatchStages) as Schema<DispatchStage>,
  message: stringSchema({ minLength: 1 }),
});

export const realtimeEventSchema: Schema<RealtimeEvent> =
  unionSchema<RealtimeEvent>([
    requirementUpdatedEventSchema as Schema<RealtimeEvent>,
    realtimeDispatchAckedEventSchema as Schema<RealtimeEvent>,
    aiStageFailedEventSchema as Schema<RealtimeEvent>,
  ]);
