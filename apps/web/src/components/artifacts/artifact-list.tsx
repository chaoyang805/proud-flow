import type { ArtifactResponse } from "@proud-flow/api-contract";
import { ExternalLink, FileText } from "lucide-react";
import { artifactTypeLabels } from "../../lib/requirements/labels";

export function ArtifactList({
  artifacts,
  currentVersion,
}: Readonly<{
  artifacts: ArtifactResponse[];
  currentVersion: number;
}>) {
  const current = artifacts.filter(
    (artifact) => artifact.requirementVersion === currentVersion,
  );
  const historical = artifacts.filter(
    (artifact) => artifact.requirementVersion !== currentVersion,
  );

  return (
    <section className="space-y-4">
      <ArtifactGroup title="当前版本产物" artifacts={current} empty="暂无当前版本产物" />
      <ArtifactGroup title="历史参考产物" artifacts={historical} empty="暂无历史产物" />
    </section>
  );
}

function ArtifactGroup({
  title,
  artifacts,
  empty,
}: Readonly<{
  title: string;
  artifacts: ArtifactResponse[];
  empty: string;
}>) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-zinc-800">{title}</h2>
      {artifacts.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--line)] bg-white px-3 py-4 text-sm text-zinc-500">
          {empty}
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {artifacts.map((artifact) => (
            <article
              key={artifact.id}
              className="rounded-md border border-[var(--line)] bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <FileText size={14} aria-hidden />
                    <span>{artifactTypeLabels[artifact.type]}</span>
                    <span>v{artifact.requirementVersion}</span>
                  </div>
                  <h3 className="mt-1 truncate text-sm font-medium text-zinc-900">
                    {artifact.title}
                  </h3>
                </div>
                {artifact.url ? (
                  <a
                    className="focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--line)] text-zinc-600 hover:bg-zinc-50"
                    href={artifact.url}
                    target="_blank"
                    rel="noreferrer"
                    title="打开产物"
                  >
                    <ExternalLink size={15} aria-hidden />
                  </a>
                ) : null}
              </div>
              {artifact.content ? (
                <p className="mt-2 line-clamp-3 text-sm text-zinc-600">
                  {artifact.content}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

