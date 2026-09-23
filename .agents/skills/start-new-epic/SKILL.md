---
name: start-new-epic
description: Prepare an ordered, resumable TDD task plan for an epic ID from Oathforge's mvp-backlog.md. Use for starting or planning an epic, not implementing it.
---

# Start new epic

Input: `/start-new-epic MVP-xx` in Claude Code or `$start-new-epic MVP-xx` in Codex. Resolve the ID against `docs/delivery/mvp-backlog.md`; never treat it as an arbitrary path. If missing or unknown, request a valid ID before creating files.

Output: `.local/epics/EPIC-ID.md`. Research, when needed: `.local/epics/EPIC-ID.journal.md`. These paths, the task schema and the stopping rules are **local workflow decisions** for this skill. Plan only; do not implement tasks, mark the epic started/done, or rewrite product decisions.

## Establish context

1. Read root instructions, `docs/README.md`, `.agents/rules/engineering.md`, `.agents/rules/workflow.md` and `.agents/rules/evidence.md`.
2. Read the exact epic row, its dependencies, relevant unresolved decisions and scope caps in the backlog. Read `docs/product/mvp.md`, `docs/engineering/architecture.md`, `docs/engineering/testing.md` and `docs/engineering/development.md`; follow links to domain, security, AI, art or other rules that affect this epic.
3. Inspect relevant implementation, tests, manifests and Git status. Record what exists versus what is proposed. Verify prerequisite epics from artifacts and checks, not their labels alone. Read relevant skills from `.agents/README.md` when their guidance changes this plan; do not load unrelated skills or all documentation.
4. Check for an existing plan and journal. Preserve task IDs, completed evidence and user edits. Reconcile only affected unfinished work; never overwrite a plan blindly.

Explore before planning and give the executing agent concrete context and verification criteria. **Basis:** [Anthropic agentic coding practices](https://code.claude.com/docs/en/best-practices), checked 2026-09-23. The project-specific reading set is a local decision.

## Resolve uncertainty before declaring readiness

If a requirement is unclear, contradictory, technically unsound or unsupported, pause plan finalization and:

1. State the issue and cite the exact local requirement or observed evidence.
2. Research the relevant technical premise using official, version-specific documentation or original authors. Search only public technical questions; do not send private project data. Web evidence cannot decide the owner's product preferences.
3. Append a concise journal entry: issue, sources/URLs and access date, findings, viable options, recommended option with tradeoff, affected task IDs and the decision needed. Distinguish sourced facts from inference.
4. Save a `blocked` plan containing established scope and any safe partial breakdown. Do not invent acceptance values, silently adopt the recommendation or continue into implementation.
5. Stop and report the recommendation and the specific decision needed. If browsing is unavailable or inconclusive, record that limitation and recommend the next evidence or decision needed rather than claiming resolution.

This research → journal → recommendation → stop sequence is the user's local workflow. A known unfinished prerequisite is an explicit dependency, not automatically an ambiguous requirement; do not research settled choices merely because implementation is absent.

## Structure executable work

Use [the plan contract](references/plan-contract.md). Write for an agent resuming without this conversation: exact source paths/sections, concrete preconditions, scoped files/contracts, observable outcomes and executable checks. No motivational prose or generic best-practice lists.

- Split the next useful slice into small tasks, each with one verifiable behavior or necessary enabling capability. Keep later epic scope in a coverage map until its details are stable; do not pretend a partial slice completes the epic. **Local adaptation:** [backlog task guidance](../../../docs/delivery/mvp-backlog.md).
- Order tasks by prerequisites. Keep a behavior's tests and implementation in the same task; avoid separate test and implementation queues. Each dependency names an earlier task or an explicit external prerequisite. **Local task convention**, informed by [Fowler's test-first cycle](https://www.martinfowler.com/bliki/TestDrivenDevelopment.html), updated 2023-12-11.
- Define concrete input/state → action → expected result scenarios, including relevant boundary and failure cases. Map every epic acceptance requirement to a task or deferred slice. **Local traceability convention**, informed by [Anthropic verification guidance](https://code.claude.com/docs/en/best-practices), checked 2026-09-23.
- For code tasks, specify the first failing behavioral test, minimal passing behavior and regression check. Repeat red → green → refactor for each scenario. A broken environment is not behavioral red; an already passing test means inspect existing coverage or refine the missing behavior. Do not weaken assertions to get green. **Basis:** [Fowler, TDD](https://www.martinfowler.com/bliki/TestDrivenDevelopment.html), updated 2023-12-11; failure classification is a local convention.
- If no test harness exists, put its minimal setup before dependent code tasks. Mark future commands as proposed and identify which task establishes them. Do not install tooling during planning. For decision, documentation or artwork tasks, use explicit artifact/review checks and state why behavioral TDD does not apply. **Local adaptation:** [testing strategy](../../../docs/engineering/testing.md).

## Persist and verify

Ensure `/.local/epics/` is ignored in the root `.gitignore`; add that narrow rule only if needed. Check `git check-ignore` for both output paths and `git ls-files -- <paths>` for previously tracked files. If tracked, stop and report the conflict; do not untrack user files automatically. Never force-add these artifacts.

Write the plan using repository-root-relative paths so it survives a new session. Check dependency order, acceptance coverage, actionable red/green criteria, command provenance, unresolved decisions and consistency with current files. A ready plan has no unresolved requirement for its next executable task; later prerequisites remain explicit.

Return only the plan path, readiness, next task or blocking recommendation, and validation performed. Do not claim implementation, passing application tests or verified host discovery from a planning run.
