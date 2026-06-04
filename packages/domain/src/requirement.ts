export const requirementStatuses = [
  "planning",
  "tech-design",
  "tech-review",
  "case-rundown",
  "case-review",
  "developing",
  "delivery",
  "archived",
] as const;

export type RequirementStatus = (typeof requirementStatuses)[number];

export const priorities = ["low", "medium", "high", "urgent"] as const;

export type Priority = (typeof priorities)[number];

export interface Requirement {
  id: string;
  title: string;
  description: string;
  status: RequirementStatus;
  priority: Priority;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function isRequirementStatus(value: string): value is RequirementStatus {
  return requirementStatuses.includes(value as RequirementStatus);
}

export function isPriority(value: string): value is Priority {
  return priorities.includes(value as Priority);
}
