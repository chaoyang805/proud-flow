"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ArtifactList } from "../artifacts/artifact-list";
import { RequirementActionPanel } from "../review/action-panel";
import { createWebApiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/query/keys";
import { AppFrame } from "./app-frame";
import { RequirementPriorityBadge, RequirementStatusBadge } from "./badges";

export function RequirementDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const client = createWebApiClient();
  const requirement = useQuery({
    queryKey: queryKeys.requirements.detail(id),
    queryFn: () => client.requirements.get(id),
  });
  const artifacts = useQuery({
    queryKey: queryKeys.requirements.artifacts(id),
    queryFn: () => client.artifacts.list(id),
  });

  return (
    <AppFrame>
      <div className="space-y-4">
        <Link
          href="/requirements"
          className="focus-ring inline-flex items-center gap-2 rounded-md text-sm text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft size={15} aria-hidden />
          返回
        </Link>
        {requirement.isLoading ? (
          <div className="rounded-md border border-[var(--line)] bg-white p-6 text-sm text-zinc-500">
            加载中
          </div>
        ) : requirement.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {requirement.error.message}
          </div>
        ) : requirement.data ? (
          <>
            <section className="rounded-md border border-[var(--line)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-zinc-500">
                      {requirement.data.id}
                    </span>
                    <RequirementStatusBadge status={requirement.data.status} />
                    <RequirementPriorityBadge priority={requirement.data.priority} />
                    <span className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-zinc-500">
                      v{requirement.data.version}
                    </span>
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950">
                    {requirement.data.title}
                  </h1>
                </div>
                <button
                  type="button"
                  className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
                  onClick={() => {
                    void requirement.refetch();
                    void artifacts.refetch();
                  }}
                >
                  <RefreshCw size={15} aria-hidden />
                  刷新
                </button>
              </div>
              <div className="mt-4 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-zinc-50 px-3 py-3 text-sm leading-6 text-zinc-700">
                {requirement.data.description}
              </div>
            </section>
            <RequirementActionPanel requirement={requirement.data} />
            <ArtifactList
              artifacts={artifacts.data?.items ?? []}
              currentVersion={requirement.data.version}
            />
          </>
        ) : null}
      </div>
    </AppFrame>
  );
}

