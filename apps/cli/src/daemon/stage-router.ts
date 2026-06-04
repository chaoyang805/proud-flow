import type { DispatchStage } from "@proud-flow/domain";

const stageCommands = {
  tech_design: "/tech-design",
  case_rundown: "/case-rundown",
  development: "/develop",
} as const satisfies Record<DispatchStage, string>;

export function createStageCommand(
  stage: DispatchStage,
  requirementId: string,
): string {
  return `${stageCommands[stage]} ${requirementId}`;
}
