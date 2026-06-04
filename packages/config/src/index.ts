export const workspacePackageGlobs = [
  "apps/*",
  "packages/*",
  "skills/*",
] as const;

export const rootQualityTasks = [
  "build",
  "typecheck",
  "lint",
  "test",
  "test:coverage",
  "test:e2e",
] as const;

export type RootQualityTask = (typeof rootQualityTasks)[number];

export function isRootQualityTask(task: string): task is RootQualityTask {
  return rootQualityTasks.includes(task as RootQualityTask);
}
