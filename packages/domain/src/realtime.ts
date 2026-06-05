import type { DispatchStage } from "./dispatch";
import type { RequirementStatus } from "./requirement";

export interface RequirementUpdatedEvent {
  type: "requirement.updated";
  eventId: string;
  requirementId: string;
  status: RequirementStatus;
  message: string;
}

export interface RealtimeDispatchAckedEvent {
  type: "dispatch.acked";
  eventId: string;
  requirementId: string;
  success: boolean;
  message: string;
}

export interface AiStageFailedEvent {
  type: "ai_stage.failed";
  eventId: string;
  requirementId: string;
  stage: DispatchStage;
  message: string;
}

export type RealtimeEvent =
  | RequirementUpdatedEvent
  | RealtimeDispatchAckedEvent
  | AiStageFailedEvent;
