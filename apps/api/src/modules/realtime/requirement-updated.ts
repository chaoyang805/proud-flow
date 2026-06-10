import type { Requirement, RequirementStatus } from "@proud-flow/domain";
import type { ApiEnv } from "../../env";
import { broadcastRealtimeEvent } from "./broadcast";
import type { RealtimeHub } from "./hub";

const REQUIREMENT_UPDATED_MESSAGES: Record<RequirementStatus, string> = {
  planning: "需求已回到规划阶段",
  "tech-design": "已进入技术方案阶段",
  "tech-review": "技术方案已完成，待 review",
  "case-rundown": "已进入用例设计阶段",
  "case-review": "用例设计已完成，待 review",
  developing: "已进入开发阶段",
  delivery: "开发已完成，待验收",
  archived: "需求已归档",
};

export function createRequirementUpdatedEvent(requirement: Requirement) {
  return {
    type: "requirement.updated" as const,
    eventId: `evt_${Date.now().toString(36)}`,
    requirementId: requirement.id,
    status: requirement.status,
    message: REQUIREMENT_UPDATED_MESSAGES[requirement.status],
  };
}

export async function broadcastRequirementUpdated(
  env: ApiEnv,
  hub: RealtimeHub | undefined,
  requirement: Requirement,
): Promise<void> {
  await broadcastRealtimeEvent(env, hub, createRequirementUpdatedEvent(requirement));
}
