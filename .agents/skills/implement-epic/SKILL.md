---
name: implement-epic
description: Execute an existing Oathforge epic plan task by task with TDD, review, local commits and merges to main, preserving resumable progress. Use for implementation, not creating an epic plan.
---

# Implement epic

Input: `$implement-epic EPIC-ID` in Codex or `/implement-epic EPIC-ID` in Claude Code. Resolve the ID against `docs/delivery/mvp-backlog.md`; never interpolate arbitrary input into paths or shell commands.

This workflow is a **local decision: owner instruction, 2026-09-23**. Invoking it to implement an epic authorizes each task's local branch, commit and merge to `main`; do not ask again for these routine steps. Creating/editing this skill does not invoke the workflow. Push, deployment, publication and paid/live provider actions are not implied.

## Load or resume

1. Require `.local/epics/EPIC-ID.md`. If absent, stop with: “Prepare the plan first using `$start-new-epic EPIC-ID`.” Do not create an implementation plan in its place. For an invalid/missing ID, request a valid backlog ID.
2. Read `AGENTS.md`, `.agents/rules/workflow.md`, `.agents/rules/engineering.md`, `.agents/rules/security.md`, the plan, any journal and existing task records. Read only the linked specifications needed for the next task. Verify prerequisites from artifacts and checks, not status labels. Respect a blocked plan; missing external inputs may use the dummy policy below, but do not silently resolve contradictory acceptance rules.
3. Use `.local/epics/EPIC-ID.md` and `.local/tasks/EPIC-ID_TASK-ID.md` as canonical progress paths (with the leading dot). A plan task `MVP-02-T01` maps to `TASK-ID=T01`, record `.local/tasks/MVP-02_T01.md`, branch `feature/MVP-02_T01`. Keep the plan's original full task ID unchanged.
4. Ensure root `.gitignore` narrowly ignores `/.local/epics/` and `/.local/tasks/`. Check both actual paths with `git check-ignore` and `git ls-files -- <paths>` before writing. Stop on tracked progress files; never untrack or force-add them automatically.
5. Reconcile the plan, task record, working tree and Git history using [the progress contract](references/progress.md). Resume the unfinished phase rather than recreating branches or repeating commits. An unchecked task may already be committed/merged after an interruption; verify its SHA and merge ancestry before updating the record.

## Execute one task at a time

Follow dependency order. Normally, do not start the next task before the current task's reviewed commit is integrated into `main` and progress is saved. If missing input blocks the task, checkpoint it as blocked and unchecked, preserve its edits on its own branch/worktree, and continue only a task with satisfied dependencies in a separate clean branch/worktree from `main`. Do not carry blocked edits forward. Keep blocked tasks in the final report and revisit them when their inputs become available; this exception does not bypass failing checks or review findings.

### Branch and checkpoint

Inspect current branch, worktrees, dirty files and any unfinished Git operation. Preserve user changes. On a new clean run, create the task branch from local `main` using the [branch convention](../../rules/workflow.md#task-branches). Do not reset/recreate an existing branch. If the main checkout has unrelated changes, use a separate task worktree from `main`; keep progress in the original checkout's ignored directories and record both locations. Never sweep unrelated changes into an automatic task commit. If `main` is absent or integration cannot proceed safely, record the actual blocker and stop without rewriting history.

Record branch, base SHA, task scope and phase before edits. Set the plan task in progress and keep its checkbox unchecked.

### Red → green → refactor

For each code behavior, write the smallest clear test of a realistic input/state → action → result. Run it and record the observed behavioral failure before implementing the minimum passing behavior. Run it again for green, then refactor and run focused regressions and required checks. **Basis:** [Fowler's TDD cycle](https://www.martinfowler.com/bliki/TestDrivenDevelopment.html), updated 2023-12-11; [project testing strategy](../../../docs/engineering/testing.md).

Tests must be minimal, common-sense and unambiguous: prefer a concrete success case plus relevant boundaries/failures over elaborate fixtures, internal-call assertions or a speculative test matrix. Do not drop meaningful authorization, duplicate-delivery or failure scenarios required by the task merely to shorten tests. This simplicity requirement is the owner's local decision.

A broken environment is not behavioral red. Establish a minimal harness first when the plan calls for setup. If the scenario already passes, inspect coverage and target the actual missing behavior; do not manufacture failure or weaken assertions. For documentation, decision or artwork-only tasks, record artifact/review checks and why behavioral TDD is inapplicable, as defined by the [plan contract](../start-new-epic/references/plan-contract.md). Do not invent dummy unit tests for prose or visual judgment.

Checkpoint actual red and green results as they occur. After interruption, inspect tests and edits; never report an unobserved earlier red. If evidence is missing, reconstruct the test against the recorded base in a disposable environment when feasible, without reverting user work.

### Review, document and integrate

1. After every task, use [oathforge-review](../oathforge-review/SKILL.md) on the complete task diff against its recorded base, including new files. Prefer a read-only independent reviewer when available; provide the task acceptance and relevant source paths. Otherwise perform and label a local review. This skill authorizes fixing relevant findings; re-run affected tests and review the fixes until no actionable correctness/regression findings remain. Record unresolved blockers and stop if they cannot be fixed within scope.
2. Write reasonably short documentation of changed behavior/setup and meaningful limitations. Update affected tracked docs and backlog status to verified facts; preserve draft vs accepted vs implemented distinctions. Review any substantive change made after the review, and run required checks before committing.
3. Apply the [commit convention](../../rules/workflow.md#commits): inspect all uncommitted non-ignored changes in the task checkout, run checks, stage and verify the complete intended diff, then create one new task commit. Use `<arch|web|api|docs> - <gerund phrase>`, at most 10 words, with short reason bullets. This is not permission to amend or rewrite prior commits. Ignored progress stays local.
4. Record the commit SHA immediately. Merge the task branch locally into `main`, preferring fast-forward when possible. If `main` advanced, integrate its changes on the task branch first, resolve only conflicts whose intended behavior is clear, and re-run affected checks/review before merging. Never overwrite unrelated work or bypass a failing check. If the `main` checkout is dirty, preserve it and pause integration rather than stash/reset user work automatically.
5. Verify the task commit is an ancestor of `main`; record the integration SHA and verification. Only now mark the task checkbox `[x]`, task status done and next-task pointer. A task completed with a dummy must explicitly say so, with pending real validation visible. Continue the next task using the same cycle from updated `main`.

If a prepared plan covers only a first slice, do not declare the epic complete at its end. Use `start-new-epic` to refine the next covered slice, preserving IDs/evidence and its research/blocking rules; then resume implementation. Do not expand beyond the epic acceptance coverage.

## Missing inputs and dummy placeholders

Missing credentials, graphics, artwork or other external information should not interrupt work that can be implemented with a clearly labeled `DUMMY` replacement. Use deterministic fake adapters, synthetic fixtures, inert configuration examples and obvious provisional visuals. Keep real provider calls disabled in dummy mode; do not make fake credentials look valid, bypass authentication or report simulated integration as live verification. Follow the existing security and artwork rules for where assets belong.

For missing information, record a reversible provisional assumption and isolate it in configuration or an adapter. Do not replace an accepted rule or silently select contradictory product outcomes. If an unknown determines correctness or acceptance and no bounded dummy can preserve the contract, record that part as blocked, continue only independent planned work, and report the limitation. This is not a waiver of a plan's requirements.

Maintain the detailed needs list as work proceeds: missing item, exact file/config/asset or decision, dummy currently used, affected tasks, replacement instructions and verification still required. Never put secrets in progress notes. Tests passing against dummies establish only the implemented local behavior. Keep acceptance rows requiring real credentials/assets/provider/device evidence pending; label the overall result “implementation complete with placeholders; acceptance pending” when applicable, not an unqualified epic done.

## Final output

Report the epic outcome, completed/remaining tasks, checks, local commits/merges and progress paths briefly. Always end with:

```text
WHAT IS NEEDED:
- Detailed missing item, location, dummy used, replacement action and required validation.
```

Write `- Nothing outstanding.` when empty. Include the accumulated list even if execution stops before epic completion, so missing inputs survive the handoff.
