import type { Priority, RequirementStatus } from "@proud-flow/domain";

export interface RequirementFilters {
  status?: RequirementStatus | "all";
  priority?: Priority | "all";
  keyword?: string;
}

export const queryKeys = {
  requirements: {
    list: (filters: RequirementFilters) => ["requirements", "list", filters] as const,
    detail: (id: string) => ["requirements", "detail", id] as const,
    artifacts: (id: string) => ["requirements", "artifacts", id] as const,
  },
};

