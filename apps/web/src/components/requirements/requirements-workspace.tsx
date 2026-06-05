"use client";

import type { Priority, RequirementStatus } from "@proud-flow/domain";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createWebApiClient } from "../../lib/api/client";
import { queryKeys, type RequirementFilters } from "../../lib/query/keys";
import { priorityLabels, statusLabels } from "../../lib/requirements/labels";
import { AppFrame } from "./app-frame";
import { RequirementPriorityBadge, RequirementStatusBadge } from "./badges";

const statuses: Array<RequirementStatus | "all"> = [
  "all",
  "planning",
  "tech-design",
  "tech-review",
  "case-rundown",
  "case-review",
  "developing",
  "delivery",
  "archived",
];

const priorities: Array<Priority | "all"> = ["all", "low", "medium", "high", "urgent"];

export function RequirementsWorkspace() {
  const [filters, setFilters] = useState<RequirementFilters>({
    status: "all",
    priority: "all",
    keyword: "",
  });
  const client = createWebApiClient();
  const query = useQuery({
    queryKey: queryKeys.requirements.list(filters),
    queryFn: () => client.requirements.list(),
  });

  const items = useMemo(() => {
    const keyword = filters.keyword?.trim().toLowerCase();
    return (query.data?.items ?? []).filter((requirement) => {
      if (filters.status && filters.status !== "all" && requirement.status !== filters.status) {
        return false;
      }
      if (
        filters.priority &&
        filters.priority !== "all" &&
        requirement.priority !== filters.priority
      ) {
        return false;
      }
      if (!keyword) return true;
      return (
        requirement.id.toLowerCase().includes(keyword) ||
        requirement.title.toLowerCase().includes(keyword)
      );
    });
  }, [filters, query.data?.items]);

  return (
    <AppFrame>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
              需求工作台
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {query.isLoading ? "加载中" : `${items.length} 个需求`}
            </p>
          </div>
          <div className="grid w-full gap-2 md:w-auto md:grid-cols-[180px_160px_260px]">
            <select
              className="focus-ring h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
              value={filters.status}
              onChange={(event) =>
                setFilters((value) => ({
                  ...value,
                  status: event.target.value as RequirementStatus | "all",
                }))
              }
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "全部状态" : statusLabels[status]}
                </option>
              ))}
            </select>
            <select
              className="focus-ring h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
              value={filters.priority}
              onChange={(event) =>
                setFilters((value) => ({
                  ...value,
                  priority: event.target.value as Priority | "all",
                }))
              }
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority === "all" ? "全部优先级" : priorityLabels[priority]}
                </option>
              ))}
            </select>
            <label className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                size={16}
                aria-hidden
              />
              <input
                className="focus-ring h-10 w-full rounded-md border border-[var(--line)] bg-white pl-9 pr-3 text-sm"
                value={filters.keyword}
                placeholder="搜索编号或标题"
                onChange={(event) =>
                  setFilters((value) => ({ ...value, keyword: event.target.value }))
                }
              />
            </label>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">编号</th>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">优先级</th>
                <th className="px-4 py-3 font-medium">版本</th>
                <th className="px-4 py-3 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((requirement) => (
                <tr
                  key={requirement.id}
                  className="border-b border-[var(--line)] last:border-b-0 hover:bg-zinc-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-600">
                    <Link className="focus-ring rounded-sm" href={`/requirements/${requirement.id}`}>
                      {requirement.id}
                    </Link>
                  </td>
                  <td className="max-w-[360px] px-4 py-3">
                    <Link
                      className="focus-ring block truncate rounded-sm font-medium text-zinc-900"
                      href={`/requirements/${requirement.id}`}
                    >
                      {requirement.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <RequirementStatusBadge status={requirement.status} />
                  </td>
                  <td className="px-4 py-3">
                    <RequirementPriorityBadge priority={requirement.priority} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600">v{requirement.version}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDate(requirement.updatedAt)}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    {query.isError ? "无法加载需求" : "暂无需求"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppFrame>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

