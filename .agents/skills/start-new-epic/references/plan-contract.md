# Agent execution plan contract

This schema is a local workflow choice for `start-new-epic`. Replace bracketed fields with concrete epic details; omit irrelevant fields rather than leaving placeholders. All paths in generated plans are relative to the repository root.

```markdown
# EPIC-ID — Epic title

Plan: ready | blocked
Epic implementation: [verified state, separate from planning status]
Outcome: [bounded observable result]
Sources: [backlog row and relevant document paths/sections]
Current state: [relevant artifacts and checks actually observed]
Scope: [included behavior]
Excluded: [explicit limits]
Prerequisites: [epic/task/decision, evidence, satisfied or pending]
Decisions: [accepted choices with sources; unresolved issues and journal path]
Next task: [stable ID, or blocking decision]

## Acceptance coverage

| Epic requirement | Task IDs or later slice | Verification |
| --- | --- | --- |
| [requirement] | [coverage] | [observable evidence] |

## Ordered tasks

### EPIC-ID-T01 — [one verifiable outcome]

Status: ready | not started | in progress | blocked | done
Depends on: [earlier task IDs or explicit external prerequisites]
Read: [specific files/sections needed for this task]
Change scope: [files/modules/contracts; proposed paths labeled new]
Outcome: [behavior or artifact delivered]
Acceptance:
- Given [concrete state/input], when [action], then [observable result].
- [relevant failure/boundary scenario with a defined result]
Red: [test location/layer, first case, command + working directory, expected behavioral failure]
Green: [minimum behavior needed to satisfy the scenario]
Refactor/check: [focused regression command and relevant static/integration checks]
Done evidence: [initially none; later record red/green command results and changed artifacts]
Handoff: [remaining issue or next task; initially not executed]

## Later slices

[Remaining epic outcomes, dependency order and trigger for detailed breakdown. Omit if all scope is covered above.]

## Execution protocol

Re-read applicable instructions and check current files before executing the next task.
Follow task order; skip done work only after checking its evidence still applies.
Set one task in progress. For each scenario, observe behavioral red, implement green,
then refactor with tests passing. Record commands, results and artifacts after the task.
Do not mark done based only on a plan, code generation or unrelated passing checks.
If assumptions fail, update the task and next-task pointer; use the skill's research/journal/stop
workflow for unclear or invalid requirements. Planning does not authorize external publication.
The epic remains incomplete while acceptance coverage or required verification is outstanding.
```

For non-code tasks replace Red/Green/Refactor with `Verification mode`, `Artifact`, `Review criteria` and `Check`. Do not invent failing tests for policy decisions or visual judgment. For setup tasks distinguish harness checks from later behavioral TDD. Commands not yet available must be labeled proposed and linked to the task that establishes them.

For executable tasks, split any acceptance scenario that requires an independent design decision or unrelated change into its own task. Include API contracts, authorization, duplicate delivery, time boundaries or provider failures only where the behavior requires them. Prefer test fixtures with fixed inputs, clock and provider outcomes over live services; follow the project's testing/security rules.

Journal entries use: date; issue and local source; public research sources; facts versus inference; options/tradeoffs; recommendation; affected tasks; decision pending/resolved. Preserve prior findings, but recheck time-sensitive claims before relying on them.
