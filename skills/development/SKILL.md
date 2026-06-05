# Development

Use this skill when Proud Flow dispatches `/develop <requirementId>` or when the user asks you to implement a Proud Flow requirement.

## Goal

Turn reviewed design and test artifacts into a delivery artifact that is ready for human acceptance.

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
4. Create or switch to the implementation branch required by the task context.
5. Implement the requested change with focused tests.
6. Run the required verification commands for the repository.
7. Attach the delivery artifacts:

   ```text
   proud-flow attach-artifact <requirementId> --type code_pr --title "Implementation PR" --url <artifact-url>
   proud-flow upload-artifact <requirementId> --type test_report --title "Test report" --file <report-file>
   ```

   Add screenshots with `--type screenshot` when they are needed for acceptance.

8. Re-read the task context and confirm the requirement is still on the expected version.
9. Complete the stage:

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
