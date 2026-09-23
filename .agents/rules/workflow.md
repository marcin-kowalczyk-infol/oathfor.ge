# Work and delegation protocol

These are local workflow conventions under [ADR 0001](../../docs/decisions/0001-project-foundation.md), informed by [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [Claude subagents](https://code.claude.com/docs/en/sub-agents).

## Main agent

Inspect current status and relevant files. Define the smallest complete result for the user's request, implement it, run relevant checks and report remaining limitations. Avoid interrupting authorized work for routine reversible decisions. Respect host policies and the user's actual scope.

Delegate only when a bounded task can make useful independent progress. For each delegation provide:
- objective and relevant canonical role path;
- inputs and exact file ownership or read-only scope;
- acceptance criteria and expected return format;
- constraints and unresolved decisions.

Keep one writer per file or use an isolated worktree for conflicting work. A subagent may propose an out-of-scope change but must not silently expand its assignment. Main agent reviews integration and owns the final result.

## Return contract

Return findings/changes, supporting file locations, checks performed, open questions and limitations. Review roles stay read-only unless explicitly reassigned.

Do not require a fixed number of subagents, hardcode their model, or delegate dependent tiny steps. If no delegation tool exists, apply the role in the main agent and report that honestly.

## Completion

Update relevant documentation when behavior changes. For significant architectural choices add/supersede an ADR. Summarize outcome, validation and material limitations; do not claim commit, push, deployment or live verification unless performed.

## Task branches

**Local decision: owner instruction, 2026-09-23.** Name task branches `feature/EPIC-ID_TASK-ID` for planned additions or `bugfix/EPIC-ID_TASK-ID` for fixes. For plan task `MVP-02-T01`, use `feature/MVP-02_T01` or `bugfix/MVP-02_T01`; retain the full task ID in the plan. Create each new task branch from local `main`, and resume an existing matching branch only after checking its history and task record.

The [implement-epic skill](../skills/implement-epic/SKILL.md) executes prepared plans with TDD, per-task review, short documentation, a convention-compliant commit and local merge to `main` before the next task. An implementation invocation authorizes that local cycle, not push or deployment. Preserve unrelated changes; use an isolated task worktree when needed and do not include unrelated edits in automatic task commits. Keep resumable records in ignored `.local/tasks/` and checkmarks in `.local/epics/`.

## Commits

**Local decision: owner instruction, 2026-09-23.** An explicit “commit” request means one new commit combining all current uncommitted changes: staged, unstaged, deleted and non-ignored untracked files, including changes from earlier work. Preserve their contents. Here, “squash commit” means combining working changes, not amending, rebasing or squashing existing commits. Do not push unless requested. If there are no changes, report that without creating an empty commit.

Inspect the complete diff and untracked files, run applicable repository checks, then stage the full intended change set. Respect ignored artifacts and secret-handling rules; do not force-add ignored files. Verify the staged diff before committing. If a conflict, sensitive file or failed required check prevents completion, report the specific blocker rather than silently omitting changes or bypassing checks.

Title format: `<scope> - <gerund phrase>`. Choose exactly one scope: `arch` for architecture, tooling or agent configuration; `web` for web/mobile client work; `api` for backend work; `docs` for documentation. For mixed changes, choose the dominant purpose and cover the other changes in the body. These scope mappings are local conventions.

Keep the entire title to at most 10 whitespace-separated words, including the scope and separator. Start the phrase with an English gerund such as `adding`, `fixing`, `removing` or `simplifying`. Use a single line without a trailing period.

After a blank line, write short `- ` bullets that explain why each meaningful change or related group of changes was needed. Name the change and its reason or intended benefit. Derive reasons from the work and requirements; do not invent measured improvements. Avoid file inventories, vague cleanup claims and repeating the title.

Example:

```text
arch - adding resumable epic planning

- Adding task contracts so agents can resume with explicit acceptance criteria.
- Ignoring local plans to keep execution notes out of shared history.
- Recording research blockers to prevent unresolved rules becoming implementation assumptions.
```

After committing, report the commit hash, title, validation results and any remaining working-tree changes.
