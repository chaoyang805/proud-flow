import type {
  ArtifactType,
  DispatchStage,
  Priority,
  RequirementStatus,
} from "@proud-flow/domain";

export const statusLabels: Record<RequirementStatus, string> = {
  planning: "规划中",
  "tech-design": "技术方案中",
  "tech-review": "技术方案待审",
  "case-rundown": "用例设计中",
  "case-review": "用例待审",
  developing: "开发中",
  delivery: "交付验收",
  archived: "已归档",
};

export const priorityLabels: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export const artifactTypeLabels: Record<ArtifactType, string> = {
  tech_design_pr: "技术方案",
  case_rundown_pr: "用例 PR",
  case_rundown_doc: "用例文档",
  development_pr: "开发 PR",
  test_report: "测试报告",
  screenshot: "截图",
  acceptance_record: "验收记录",
  note: "备注",
};

export const dispatchStageLabels: Record<DispatchStage, string> = {
  tech_design: "技术方案",
  case_rundown: "用例设计",
  development: "开发交付",
};

export function stageForStatus(
  status: RequirementStatus,
): DispatchStage | undefined {
  if (status === "planning") return "tech_design";
  if (status === "tech-review") return "case_rundown";
  if (status === "case-review") return "development";
  return undefined;
}

export function reviewApproveLabel(status: RequirementStatus): string | undefined {
  if (status === "tech-review") return "通过技术方案";
  if (status === "case-review") return "通过用例";
  if (status === "delivery") return "验收通过";
  return undefined;
}

