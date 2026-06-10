import type { DispatchStage } from "@proud-flow/domain";

const stageSkillNames = {
  tech_design: "tech-design",
  case_rundown: "case-rundown",
  development: "development",
} as const satisfies Record<DispatchStage, string>;

export function resolveStageSkillName(stage: DispatchStage): string {
  return stageSkillNames[stage];
}

export function createStagePrompt(
  stage: DispatchStage,
  requirementId: string,
): string {
  const skillName = stageSkillNames[stage];
  return `Use the $${skillName} skill to handle Proud Flow requirement ${requirementId}.`;
}
