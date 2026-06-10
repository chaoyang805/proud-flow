---
name: development
description: Use when Proud Flow dispatches the development stage or when asked via $development <requirementId> to implement a requirement.
---

# Development

Use this skill when Proud Flow dispatches `$development <requirementId>` or when the user asks you to implement a Proud Flow requirement.

## Goal

Turn reviewed design and test artifacts into a delivery artifact that is ready for human acceptance.

## Workspace and Git Setup

Before starting stage work:

1. Check whether the workspace is a git repository (`git rev-parse --is-inside-work-tree`). If not, run `git init` first.
2. Check whether a GitHub remote is configured (`git remote -v`). Note whether `github.com` appears in any remote URL.
3. Use a git worktree tied to the requirement ID:
   - Branch: `feature/proud-flow/<requirementId>`
   - Worktree path: `.worktrees/<requirementId>` (or `../<repo>.proud-flow/<requirementId>` when the main repo layout requires it)
4. Reuse the same worktree across all stages for this requirement (`tech_design`, `case_rundown`, `development`). If the worktree already exists, switch into it instead of creating a new one.
5. Make a stage-scoped commit in that worktree when this stage produces repository changes. Commit messages must include `<requirementId>` and `development`.

When attaching or uploading artifacts:

- Always include the worktree path and branch name in the artifact title or description.
- If a GitHub remote exists, push the branch, open a PR when appropriate, and attach the PR URL with `attach-artifact --url <pr-url>`.

## Workflow

1. Read the requirement context:

   ```text
   proud-flow get-task-context <requirementId> --stage development
   ```

2. Start the stage:

   ```text
   proud-flow start-stage <requirementId> --stage development
   ```

3. Review the requirement, technical design, test case plan, review notes, current artifacts, and historical artifacts.
4. Implement the requested change with focused tests in the requirement worktree.
5. Run the required verification commands for the repository.
6. Attach the delivery artifacts:

   ```text
   proud-flow attach-artifact <requirementId> --type development_pr --title "Implementation PR" --url <artifact-url>
   proud-flow upload-artifact <requirementId> --type test_report --title "Test report" --file <report-file>
   ```

   Add screenshots with `--type screenshot` when they are needed for acceptance.

7. Re-read the task context and confirm the requirement is still on the expected version.
8. Complete the stage:

   ```text
   proud-flow complete-stage <requirementId> --stage development --summary "Implementation ready for acceptance"
   ```

## Failure Handling

If implementation cannot proceed safely, verification fails without a clear fix, or required artifacts cannot be produced, report the reason:

```text
proud-flow fail-stage <requirementId> --stage development --message "<reason>"
```

## Constraints

- Use only the `proud-flow` helper commands for platform reads and writes.
- Do not call platform network endpoints directly.
- Do not complete the stage until the implementation artifact and verification evidence are attached.
