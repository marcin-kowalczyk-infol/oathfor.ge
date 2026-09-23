# Resumable task progress

Local workflow contract: owner instruction, 2026-09-23. All paths below are repository-root-relative unless a worktree location must identify another checkout.

## Epic plan

Preserve existing task IDs, completed evidence and user edits. Add an execution checklist to older plans without one:

```markdown
## Execution progress

- [ ] MVP-02-T01 — API recipe
- [ ] MVP-02-T02 — API harness
```

Use `[x]` only after review, passing required checks, commit and verified integration into `main`. Synchronize the task's detailed Status/Done evidence/Handoff and the plan's Next task pointer. Record “done with DUMMY …; real validation pending” when appropriate; an implementation checkbox is not proof of outstanding live acceptance. Preserve the acceptance coverage and later slices until all requirements are verified.

## Task record

File example: `.local/tasks/MVP-02_T01.md`. Create before task work; update after each meaningful phase rather than only at the end. Keep evidence concise; do not paste large logs.

```markdown
# MVP-02-T01 — Task title

Status: in progress
Phase: red | green | review | commit | merge | done | blocked
Plan: .local/epics/MVP-02.md
Branch: feature/MVP-02_T01
Checkout: repository root or actual task worktree location
Base SHA: actual SHA
Scope and acceptance: concrete behavior and relevant plan section

## Evidence

- Red: command, working directory, scenario, actual failure/reason.
- Green: command, working directory, result.
- Regression/static/artifact checks: commands and actual results.
- Review: diff base, reviewer/local review, findings and resolution.
- Documentation: affected paths and short outcome.
- Commit: SHA, or not yet created.
- Integration: main SHA and ancestry check, or not yet merged.

## WHAT IS NEEDED

- Missing item; DUMMY location/value description; affected acceptance;
  replacement action; required real validation. No secret values.

## Resume

Next exact action; pending changes/blockers; evidence still needed.
```

Use “not run” for missing evidence; replace Red/Green with artifact checks for a non-code task. Record interrupted work honestly.

## Reconciliation after interruption

Inspect status and diffs before acting. Use recorded SHAs and Git history, not a checkbox alone. If the task branch already exists, verify its ownership/base and resume it. If the task commit exists but has not merged, resume integration, not a second commit. If it is already an ancestor of `main`, verify checks/review evidence and repair the progress checkpoint. If evidence is absent, perform the missing verification before marking done. If new edits appeared after the recorded commit, inspect and review them; never discard them to restore a checkpoint.

Keep progress in the original checkout when using a worktree: ignored records are not propagated by Git. Record that location in the active handoff. An external change or ambiguous merge conflict must be described precisely; do not overwrite user work to satisfy the task sequence.
