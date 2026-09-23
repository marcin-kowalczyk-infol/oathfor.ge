# Shared agent workspace

Canonical instructions live here and in [AGENTS.md](../AGENTS.md). This setup targets **Codex and Claude Code**; other Claude products may not read local project files. **Sources: [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Claude Code](https://code.claude.com/docs/en/memory).**

## One source, native discovery

| Consumer path | Relative symlink target | Purpose |
| --- | --- | --- |
| `CLAUDE.md` | `AGENTS.md` | Same root rules |
| `.claude/skills` | `../.agents/skills` | Same SKILL.md files |
| `.claude/agents` | `../.agents/subagents` | Same role prompts |
| `.codex/agents` | `../.agents/adapters/codex/agents` | Native TOML registration pointing to shared roles |

Codex discovers repo skills in `.agents/skills`. Claude discovers `.claude/skills` and supports the same basic SKILL.md format. **Sources: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Claude skills](https://code.claude.com/docs/en/skills), [Agent Skills standard](https://agentskills.io/specification).**

Codex native roles use TOML with name, description and developer_instructions; Claude roles use Markdown frontmatter. Symlinking Markdown to TOML would not convert the format. Our adapters contain only registration and a pointer to the canonical prompt. Edit behavior in `.agents/subagents/*.md`; keep adapter descriptions aligned. **Sources: [Codex roles](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Claude roles](https://code.claude.com/docs/en/sub-agents).**

No model, permissions, tools or global settings are overridden. A role's read-only instruction is behavioral, not a security sandbox. Launch from the repository root; let the host perform its normal project trust flow.

## Detailed rules

- [Engineering](rules/engineering.md): application conventions.
- [Security](rules/security.md): evidence, secrets and authorization.
- [Evidence](rules/evidence.md): sources, decisions and honest status.
- [Workflow](rules/workflow.md): bounded delegation and verification.
- [Commands](commands/README.md): runnable local checks.

## Skills

| Skill | Use |
| --- | --- |
| [start-new-epic](skills/start-new-epic/SKILL.md) | Prepare a local, ordered epic plan with TDD task contracts and research blockers |
| [implement-epic](skills/implement-epic/SKILL.md) | Execute a prepared epic with TDD, per-task review, local commits/merges and resumable progress |
| [oathforge-spec](skills/oathforge-spec/SKILL.md) | Turn a feature request into a bounded implementable specification |
| [oathforge-review](skills/oathforge-review/SKILL.md) | Review changes for Oath domain and reliability risks |
| [oathforge-art-handoff](skills/oathforge-art-handoff/SKILL.md) | Inspect selected artwork and prepare its implementation handoff |

Example: Codex `$oathforge-spec`; Claude Code `/oathforge-spec`. Plain language also works: “Use the oathforge-spec skill to specify proof resubmission.”

Epic planning: Codex `$start-new-epic MVP-01`; Claude Code `/start-new-epic MVP-01`. Plans and temporary research journals live in gitignored `.local/epics/`. This workflow prepares tasks for later execution; it does not implement the epic. **Local workflow:** [start-new-epic](skills/start-new-epic/SKILL.md).

Epic execution: Codex `$implement-epic MVP-02`; Claude Code `/implement-epic MVP-02`. Requires an existing plan; task records live in ignored `.local/tasks/`, with completion checkmarks in the plan. Missing external inputs use labeled dummy replacements where feasible and appear in the final `WHAT IS NEEDED` report. **Local workflow:** [implement-epic](skills/implement-epic/SKILL.md).

## Subagents

| Role | Bounded job |
| --- | --- |
| [product-spec](subagents/product-spec.md) | Rules, user flow, acceptance criteria |
| [backend-engineer](subagents/backend-engineer.md) | Symfony/API/domain and queue work |
| [mobile-engineer](subagents/mobile-engineer.md) | Expo mobile experience and integration |
| [referee-reviewer](subagents/referee-reviewer.md) | Evidence policy and AI evaluation review |
| [quality-reviewer](subagents/quality-reviewer.md) | Independent correctness/security/regression review |
| [art-director](subagents/art-director.md) | Identity consistency and asset readiness |

Example: “Delegate review of the proof flow to referee-reviewer, using .agents/subagents/referee-reviewer.md.”

If a host cannot register a native custom role, the main agent can pass the canonical role file to its generic delegation tool. If delegation is unavailable, read and apply that role locally; do not pretend that a separate agent ran. **Local fallback protocol.**

## Portability and verification

Preserve relative symlinks in Git. On Windows use a symlink-capable checkout (for example WSL or an appropriately configured Windows environment); a checkout containing plain target strings is not equivalent.

Run `python3 .agents/commands/check_repository.py`. It checks files/config structure, not live model behavior. To smoke-test a new host, open this repo and ask it to list project skills/roles and summarize root instructions without modifying files. For a role test, request a small read-only review and verify it read its shared role prompt.

Upstream docs reviewed 2026-09-23. Local installed versions at foundation creation: Codex CLI 0.154.0 and Claude Code 2.1.280. Versions are observations, not pinned requirements. Native discovery and role execution must be checked in the target host after starting a fresh session.
