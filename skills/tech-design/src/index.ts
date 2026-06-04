import { dispatchStages } from "@proud-flow/domain";

export const skillPackage = {
  name: "@proud-flow/skill-tech-design",
  supportedStages: dispatchStages,
} as const;

export function supportsDispatchStages(): boolean {
  return skillPackage.supportedStages.length === 3;
}
