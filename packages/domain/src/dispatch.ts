import type { RequirementStatus } from "./requirement.js";

export const dispatchStages = [
  "tech_design",
  "case_rundown",
  "development",
] as const;

export type DispatchStage = (typeof dispatchStages)[number];

export interface DispatchRequestedMessage {
  type: "dispatch.requested";
  requestId: string;
  requirementId: string;
  stage: DispatchStage;
}

export interface DispatchAckedMessage {
  type: "dispatch.acked";
  requestId: string;
  success: boolean;
  errorMessage?: string;
}

export interface DispatcherPingMessage {
  type: "dispatcher.ping";
  timestamp: string;
}

export interface DispatcherPongMessage {
  type: "dispatcher.pong";
  timestamp: string;
}

export type DispatchMessage =
  | DispatchRequestedMessage
  | DispatchAckedMessage
  | DispatcherPingMessage
  | DispatcherPongMessage;

export const dispatchStageToActiveStatus = {
  tech_design: "tech-design",
  case_rundown: "case-rundown",
  development: "developing",
} as const satisfies Record<DispatchStage, RequirementStatus>;

export function isDispatchStage(value: string): value is DispatchStage {
  return dispatchStages.includes(value as DispatchStage);
}
