import { dispatchStages } from "@proud-flow/domain";

export const skillPackage = {
  name: "@proud-flow/skill-development",
  supportedStages: dispatchStages,
} as const;

export function supportsDispatchStages(): boolean {
  return skillPackage.supportedStages.length === 3;
}
