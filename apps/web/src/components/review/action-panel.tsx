"use client";

import type { RequirementResponse } from "@proud-flow/api-contract";
import type { DispatchStage, RequirementStatus } from "@proud-flow/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { createWebApiClient } from "../../lib/api/client";
import { queryKeys } from "../../lib/query/keys";
import {
  dispatchStageLabels,
  stageForStatus,
} from "../../lib/requirements/labels";

export function RequirementActionPanel({
  requirement,
}: Readonly<{ requirement: RequirementResponse }>) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [rollbackReason, setRollbackReason] = useState("");
  const [rollbackTarget, setRollbackTarget] =
    useState<RequirementStatus>("planning");
  const stage = stageForStatus(requirement.status);
  const client = createWebApiClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["requirements"] }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirements.detail(requirement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirements.artifacts(requirement.id),
      }),
    ]);
  };

  const dispatch = useMutation({
    mutationFn: (dispatchStage: DispatchStage) =>
      client.dispatch.dispatch(requirement.id, { stage: dispatchStage }),
    onSuccess: async () => {
      setMessage("派发请求已提交，等待 daemon ACK");
      await invalidate();
    },
    onError: (error) => setMessage(formatActionError(error)),
  });

  const rollback = useMutation({
    mutationFn: () =>
      client.reviews.rollback(requirement.id, {
        targetStatus: rollbackTarget,
        reason: rollbackReason,
      }),
    onSuccess: async () => {
      setMessage("已提交回退");
      setRollbackReason("");
      await invalidate();
    },
    onError: (error) => setMessage(formatActionError(error)),
  });

  const archive = useMutation({
    mutationFn: () => client.requirements.archive(requirement.id),
    onSuccess: async () => {
      setMessage("已提交归档");
      await invalidate();
    },
    onError: (error) => setMessage(formatActionError(error)),
  });

  return (
    <section className="rounded-md border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">当前操作</h2>
          <p className="mt-1 text-sm text-zinc-500">
            提交后以后端返回为准，实时事件只触发刷新。
          </p>
        </div>
        {stage ? (
          <button
            type="button"
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            disabled={dispatch.isPending}
            onClick={() => dispatch.mutate(stage)}
          >
            <Send size={15} aria-hidden />
            派发{dispatchStageLabels[stage]}
          </button>
        ) : null}
        {requirement.status === "delivery" ? (
          <button
            type="button"
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            disabled={archive.isPending}
            onClick={() => archive.mutate()}
          >
            <Archive size={15} aria-hidden />
            归档
          </button>
        ) : null}
      </div>
      {canRollback(requirement.status) ? (
        <div className="mt-4 grid gap-2 md:grid-cols-[180px_1fr_auto]">
          <select
            className="focus-ring h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
            value={rollbackTarget}
            onChange={(event) =>
              setRollbackTarget(event.target.value as RequirementStatus)
            }
          >
            <option value="planning">规划中</option>
            <option value="tech-review">技术方案待审</option>
            <option value="case-review">用例待审</option>
            <option value="developing">开发中</option>
          </select>
          <input
            className="focus-ring h-10 rounded-md border border-[var(--line)] px-3 text-sm"
            value={rollbackReason}
            placeholder="回退原因"
            onChange={(event) => setRollbackReason(event.target.value)}
          />
          <button
            type="button"
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            disabled={!rollbackReason.trim() || rollback.isPending}
            onClick={() => rollback.mutate()}
          >
            <RotateCcw size={15} aria-hidden />
            回退
          </button>
        </div>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function canRollback(status: RequirementStatus): boolean {
  return status === "tech-review" || status === "case-review" || status === "delivery";
}

function formatActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : "操作失败";
  if (message.includes("DISPATCHER_OFFLINE")) return "Dispatcher 不在线";
  if (message.includes("INVALID_STATUS_TRANSITION")) return "状态不允许执行该操作";
  return message;
}
