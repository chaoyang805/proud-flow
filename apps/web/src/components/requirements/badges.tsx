import type { Priority, RequirementStatus } from "@proud-flow/domain";
import { priorityLabels, statusLabels } from "../../lib/requirements/labels";

const statusClasses: Record<RequirementStatus, string> = {
  planning: "border-slate-300 bg-slate-50 text-slate-700",
  "tech-design": "border-blue-200 bg-blue-50 text-blue-700",
  "tech-review": "border-amber-200 bg-amber-50 text-amber-800",
  "case-rundown": "border-cyan-200 bg-cyan-50 text-cyan-700",
  "case-review": "border-amber-200 bg-amber-50 text-amber-800",
  developing: "border-teal-200 bg-teal-50 text-teal-700",
  delivery: "border-emerald-200 bg-emerald-50 text-emerald-700",
  archived: "border-zinc-300 bg-zinc-50 text-zinc-600",
};

const priorityClasses: Record<Priority, string> = {
  low: "border-zinc-300 bg-white text-zinc-600",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

export function RequirementStatusBadge({
  status,
}: Readonly<{ status: RequirementStatus }>) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function RequirementPriorityBadge({
  priority,
}: Readonly<{ priority: Priority }>) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${priorityClasses[priority]}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}

