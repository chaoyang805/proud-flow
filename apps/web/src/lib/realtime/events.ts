import type { DispatchStage, RequirementStatus } from "@proud-flow/domain";

export type RealtimeEvent =
  | {
      type: "requirement.updated";
      eventId: string;
      requirementId: string;
      status: RequirementStatus;
      message?: string;
    }
  | {
      type: "dispatch.acked";
      eventId: string;
      requirementId: string;
      success: boolean;
      message?: string;
    }
  | {
      type: "ai_stage.failed";
      eventId: string;
      requirementId: string;
      stage: DispatchStage;
      message: string;
    };

export function parseRealtimeEvent(value: string): RealtimeEvent | undefined {
  const parsed = JSON.parse(value) as Partial<RealtimeEvent>;
  if (!parsed.type || !("eventId" in parsed) || !("requirementId" in parsed)) {
    return undefined;
  }
  return parsed as RealtimeEvent;
}

