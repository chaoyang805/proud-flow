---
name: case-rundown
description: Use when Proud Flow dispatches the case_rundown stage or when asked via $case-rundown <requirementId> to prepare test cases.
---

# Case Rundown

Use this skill when Proud Flow dispatches `$case-rundown <requirementId>` or when the user asks you to prepare test cases for a Proud Flow requirement.

## Goal

Turn an approved technical design into a reviewable test case and acceptance plan artifact.

## Workspace and Git Setup

Before starting stage work:

1. Check whether the workspace is a git repository (`git rev-parse --is-inside-work-tree`). If not, run `git init` first.
2. Check whether a GitHub remote is configured (`git remote -v`). Note whether `github.com` appears in any remote URL.
3. Use a git worktree tied to the requirement ID:
   - Branch: `feature/proud-flow/<requirementId>`
   - Worktree path: `.worktrees/<requirementId>` (or `../<repo>.proud-flow/<requirementId>` when the main repo layout requires it)
4. Reuse the same worktree across all stages for this requirement (`tech_design`, `case_rundown`, `development`). If the worktree already exists, switch into it instead of creating a new one.
5. Make a stage-scoped commit in that worktree when this stage produces repository changes. Commit messages must include `<requirementId>` and `case_rundown`.

When attaching or uploading artifacts:

- Always include the worktree path and branch name in the artifact title or description.
- If a GitHub remote exists, push the branch, open a PR when appropriate, and attach the PR URL with `attach-artifact --url <pr-url>`.

## Workflow

1. Read the requirement context:

   ```text
   proud-flow get-task-context <requirementId> --stage case_rundown
   ```

2. Start the stage:

   ```text
   proud-flow start-stage <requirementId> --stage case_rundown
   ```

3. Review the requirement, technical design artifact, review notes, current artifacts, and historical artifacts.
4. Produce a test plan covering core flows, edge cases, permissions, error handling, regression risks, automation targets, and acceptance checks.
5. Attach the case artifact:

   ```text
   proud-flow attach-artifact <requirementId> --type case_rundown_pr --title "Test case plan" --url <artifact-url>
   ```

   If the artifact is a local document instead of a URL, use `proud-flow upload-artifact` with a document title.

6. Re-read the task context and confirm the requirement is still on the expected version.
7. Complete the stage:

   ```text
   proud-flow complete-stage <requirementId> --stage case_rundown --summary "Test cases ready for review"
   ```

## Failure Handling

If the technical design is missing, contradictory, or insufficient for test planning, report the reason:

```text
proud-flow fail-stage <requirementId> --stage case_rundown --message "<reason>"
```

## Constraints

- Use only the `proud-flow` helper commands for platform reads and writes.
- Do not call platform network endpoints directly.
- Do not complete the stage without the required case artifact.
