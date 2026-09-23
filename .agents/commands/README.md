# Commands

Run from repository root. Commands are shared shell/Python entrypoints, not vendor-specific macros. **Local decision: [ADR 0001](../../docs/decisions/0001-project-foundation.md).**

| Command | Purpose |
| --- | --- |
| `python3 .agents/commands/check_repository.py` | Validate docs, local links, symlinks, skills, role adapters and artwork exclusion; Python 3.11+ |
| `git diff --check` | Whitespace check on tracked changes |
| `git status --short` | Inspect changed/untracked files |
| `mkdir -p graphics` | Recreate ignored local artwork directory after clone |

Application install/test/build commands will be added to [development](../../docs/engineering/development.md) when implemented. No dummy success targets are provided.

Skills supply reusable prompts: `$oathforge-spec` in Codex or `/oathforge-spec` in Claude Code. See [agent catalog](../README.md). No legacy `.claude/commands` copy is necessary.

The owner keeps `docs/delivery/mvp-backlog.md` local (decision, 2026-09-23). The checker permits that exact link destination to be absent in a fresh checkout; all other local destinations remain required. Epic planning/execution still needs the owner-provided backlog and local plan.
