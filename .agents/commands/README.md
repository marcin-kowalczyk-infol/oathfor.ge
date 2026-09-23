# Commands

Run from repository root. Commands are shared shell/Python entrypoints, not vendor-specific macros. **Local decision: [ADR 0001](../../docs/decisions/0001-project-foundation.md).**

| Command | Purpose |
| --- | --- |
| `python3 .agents/commands/check_repository.py` | Validate docs, local links, symlinks, skills, role adapters and artwork exclusion; Python 3.11+ |
| `python3 .agents/commands/check_api.py` | Build an isolated Compose runtime, run API/unit/integration/static checks and real HTTP; removes its own temporary project |
| `git diff --check` | Whitespace check on tracked changes |
| `git status --short` | Inspect changed/untracked files |
| `mkdir -p graphics` | Recreate ignored local artwork directory after clone |

API commands from `apps/api`: `composer install --no-interaction`, `composer validate --strict`, `composer check-platform-reqs`, `composer test`, `composer analyse`. See [development](../../docs/engineering/development.md) for prerequisites, example configuration and local HTTP startup. Service tests use `composer test:integration`; mobile commands from `apps/mobile` are `npm ci`, `npm test -- --runInBand`, `npm run typecheck`, and `npx expo install --check`.

Skills supply reusable prompts: `$oathforge-spec` in Codex or `/oathforge-spec` in Claude Code. See [agent catalog](../README.md). No legacy `.claude/commands` copy is necessary.

The owner keeps `docs/delivery/mvp-backlog.md` local (decision, 2026-09-23). The checker permits that exact link destination to be absent in a fresh checkout; all other local destinations remain required. Epic planning/execution still needs the owner-provided backlog and local plan.
