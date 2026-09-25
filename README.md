# Oathforge

A multiplayer accountability game where real-world commitments power a dark heroic Slavic fantasy world. Domain: [oathfor.ge](https://oathfor.ge).

**Status: local Symfony API, PostgreSQL/Redis integration, Apple authentication/session backend and bilingual mobile account/onboarding flow implemented. Protected immutable Oath previews and explicit acceptance exist; durable reconciliation handles activation and unknown-availability review; revision-confirmed pause/resume is implemented; the mobile first-Oath form and stored-rule confirmation are implemented; real provider and signed-device acceptance remain pending. iOS simulator connectivity acceptance passed; earlier hosted CI checks passed, with the updated Docker lifecycle workflow awaiting a hosted run.**

## Product

Players make **Oaths** with clear deadlines and evidence requirements. An AI companion intervenes before the deadline, assesses submitted proof, and supports recovery after missed commitments. Players can start alone with AI and later form squads.

Commit → deadline → AI intervention → proof → verification → reward/consequence → recovery/team progress.

The intended first validation segment is people who repeatedly skip planned workouts. The [first-loop specification](docs/product/first-loop.md) is accepted, including initial rewards and evidence rules. Apple Fitness compatibility, artwork and operational/runtime acceptance remain pending; later product scope remains draft. See [product brief](docs/product/brief.md) and [MVP](docs/product/mvp.md).

## Monorepo

| Location | Purpose |
| --- | --- |
| `apps/mobile/` | Expo + React Native + strict TypeScript account/onboarding app |
| `apps/api/` | Symfony 7.4 LTS + PostgreSQL + Redis/Messenger local runtime |
| `docs/` | Product, technical, art, delivery documentation and decisions |
| `business-plans/` | Reserved for business plans and commercial projections |
| `AGENTS.md` | Shared agent entrypoint; `CLAUDE.md` is a symlink |
| `.agents/` | Shared rules, skills, commands, subagents and adapters |
| `graphics/` | Local artwork; entirely excluded from Git |

Planned integrations: S3-compatible proof storage, RevenueCat subscriptions, OpenAI referee/companion. Initial deployment target: one VPS with 4 vCPU / 8 GB RAM. These are choices, not deployed services or capacity guarantees.

## Start here

1. Read the [documentation index](docs/README.md).
2. Agents read [AGENTS.md](AGENTS.md); setup and invocation examples are in the [agent guide](.agents/README.md).
3. Run the repository checks with Python 3.11 or newer:

```sh
python3 .agents/commands/check_repository.py
```

4. After a fresh clone, create the local artwork directory if needed:

```sh
mkdir -p graphics
```

API/mobile setup, tests, type/static checks and isolated service verification are in the [development guide](docs/engineering/development.md). The local backend starts with `docker compose -p oathforge-local up --build -d --wait` after copying the API example environment when absent; Compose installs dependencies and manages the worker. No product game loop or deployment is implemented.

Engineering documentation and code identifiers use English. MVP player-facing content supports Polish and English with natural localization; see the [language and naming rules](docs/product/glossary.md#language-and-naming-rules). Human conversation follows the user's language. Current foundation decisions and their provenance are in [ADR 0001](docs/decisions/0001-project-foundation.md).
