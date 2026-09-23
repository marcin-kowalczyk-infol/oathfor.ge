# ADR 0001: Shared monorepo and project foundation

- Status: accepted foundation; provisional details explicitly identified below.
- Date: 2026-09-23.
- Decision owner: project owner.
- Provenance: owner's Oathforge handoff and repository-setup request on 2026-09-23, following the conversation “Motywator” (6ab3abf2-4ab0-83eb-93d7-d21203385626).
- Format basis: [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## Context

Oathforge needs durable project context for both Codex and Claude Code before application scaffolding. The starting repository contained only a title in README.

## Owner-approved direction

- Oathforge, domain oathfor.ge; multiplayer accountability game with AI partner/referee, proof, deadlines, recovery and squads.
- React Native + Expo + TypeScript; Symfony 7.4 LTS + PostgreSQL + Redis + Messenger.
- VPS class 4 vCPU / 8 GB RAM; S3-compatible proof storage; RevenueCat; OpenAI.
- Original dark heroic Slavic fantasy, no borrowed franchise references or ready-made game asset packs.
- Monorepo; README, detailed docs excluding business plans, shared AGENTS instructions, reusable skills/commands, specialized subagents, ignored graphics directory.
- Cross-agent shared content through symlinks where filenames differ; cite evidence beside best-practice rules.

## Implementation conventions selected for this foundation

- Reserve `apps/mobile` and `apps/api`; scaffold runtimes in a later task.
- Keep docs and instructions in English; converse in the user's language.
- Put shared role prompts in `.agents/subagents` using Markdown with simple name/description frontmatter. Claude reads symlinked files directly; Codex TOML adapters refer to the same prompts.
- Use relative symlinks within the repository; no global agent settings, model overrides, permission bypasses or automated deployment hooks.
- Put commercial planning in root `business-plans`; no business plan is produced in this task.
- Use Python 3.11+ standard library for repository checks, independent of app dependencies.
- Validate behavior proportionately; preserve unrelated work and report validation limits.

These are local conventions, not claims that upstream vendors mandate this layout.

## Provisional product items

Fitness as the first validation segment, squads of 2–6, one companion with four progression stages, weekly boss, free/premium boundaries, penalties and proof criteria remain design proposals. “Max” is a placeholder. Leonardo is a candidate, not a locked vendor. No competitor revenues, subscription prices or cost forecasts are accepted as verified facts here.

## Consequences

One source of behavioral instructions limits drift. Two native registration formats remain because Codex uses TOML while Claude uses Markdown. Symlink-capable checkouts are required; Windows users need a setup that preserves symlinks. Ignored artwork is not delivered by cloning and requires separate backup. App runtime and live integration behavior are untested.

Future significant deviations should supersede this decision through a new ADR.
