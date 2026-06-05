# Case Rundown

Use this skill when Proud Flow dispatches `/case-rundown <requirementId>` or when the user asks you to prepare test cases for a Proud Flow requirement.

## Goal

Turn an approved technical design into a reviewable test case and acceptance plan artifact.

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
   proud-flow attach-artifact <requirementId> --type case_pr --title "Test case plan" --url <artifact-url>
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
