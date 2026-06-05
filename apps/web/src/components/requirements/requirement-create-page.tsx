"use client";

import type { Priority } from "@proud-flow/domain";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createWebApiClient } from "../../lib/api/client";
import { priorityLabels } from "../../lib/requirements/labels";
import { AppFrame } from "./app-frame";

export function RequirementCreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const client = createWebApiClient();
  const mutation = useMutation({
    mutationFn: () => client.requirements.create({ title, description, priority }),
    onSuccess: (requirement) => router.push(`/requirements/${requirement.id}`),
  });

  return (
    <AppFrame>
      <div className="max-w-3xl space-y-4">
        <Link
          href="/requirements"
          className="focus-ring inline-flex items-center gap-2 rounded-md text-sm text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft size={15} aria-hidden />
          返回
        </Link>
        <form
          className="rounded-md border border-[var(--line)] bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <h1 className="text-xl font-semibold text-zinc-950">新建需求</h1>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-700">标题</span>
              <input
                className="focus-ring h-10 rounded-md border border-[var(--line)] px-3 text-sm"
                value={title}
                required
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-700">描述</span>
              <textarea
                className="focus-ring min-h-44 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                value={description}
                required
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="grid gap-2 sm:w-56">
              <span className="text-sm font-medium text-zinc-700">优先级</span>
              <select
                className="focus-ring h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {mutation.error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {mutation.error.message}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              disabled={!title.trim() || !description.trim() || mutation.isPending}
            >
              <Save size={16} aria-hidden />
              创建
            </button>
          </div>
        </form>
      </div>
    </AppFrame>
  );
}

