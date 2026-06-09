# Tech Design

Use this skill when Proud Flow dispatches `/tech-design <requirementId>` or when the user asks you to produce the technical design for a Proud Flow requirement.

## Goal

Turn an approved requirement into a reviewable technical design artifact. The design must explain the intended implementation before code changes begin.

## Workflow

1. Read the requirement context:

   ```text
   proud-flow get-task-context <requirementId> --stage tech_design
   ```

2. Start the stage:

   ```text
   proud-flow start-stage <requirementId> --stage tech_design
   ```

3. Inspect the target repository, existing docs, previous artifacts, and review notes from the task context.
4. Produce a concise technical design covering goals, non-goals, module boundaries, data/API changes, workflow impact, test strategy, risks, and rollback.
5. Attach the design artifact:

   ```text
   proud-flow attach-artifact <requirementId> --type tech_design_pr --title "Technical design" --url <artifact-url>
   ```

   If the artifact is a local document instead of a URL, use `proud-flow upload-artifact` with a document title.

6. Re-read the task context and confirm the requirement is still on the expected version.
7. Complete the stage:

   ```text
   proud-flow complete-stage <requirementId> --stage tech_design --summary "Technical design ready for review"
   ```

## Failure Handling

If the requirement is unclear, the repository cannot be inspected, or the design cannot be completed, report the reason:

```text
proud-flow fail-stage <requirementId> --stage tech_design --message "<reason>"
```

## Constraints

- Use only the `proud-flow` helper commands for platform reads and writes.
- Do not call platform network endpoints directly.
- Do not advance the requirement without attaching the required artifact.
