# Engineering rules

Apply to implementation tasks; no application tooling exists yet.

| Rule | Basis |
| --- | --- |
| Keep Symfony controllers thin; put domain decisions in services, use dependency injection and framework-default structure | [Symfony 7.4 practices](https://symfony.com/doc/7.4/best_practices.html) |
| Make async handlers safe under repeated delivery; protect reward writes transactionally | [Messenger idempotency](https://symfony.com/doc/7.4/messenger.html#writing-idempotent-handlers); transactional reward choice: [architecture](../../docs/engineering/architecture.md) |
| Enable TypeScript strict checks when mobile is scaffolded; validate untrusted API data at runtime | [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html); runtime-boundary rule is local |
| Use the supported Expo monorepo setup; avoid speculative Metro overrides or duplicate native dependencies | [Expo monorepos](https://docs.expo.dev/guides/monorepos/) |
| Give mobile controls accessible roles/labels and meaningful state | [React Native accessibility](https://reactnative.dev/docs/accessibility) |
| Keep Oath rules server-authoritative and match UI terminology to the glossary | [Project MVP](../../docs/product/mvp.md), [glossary](../../docs/product/glossary.md) — local |
| Add dependencies for a concrete need, preserve lockfiles and document reproducible commands | [Foundation convention](../../docs/decisions/0001-project-foundation.md) — local |
| Record significant boundary/technology tradeoffs in a short ADR with status and consequences | [Nygard ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) |

Follow the existing formatter once configured. Do not introduce a code-style toolchain merely to edit documentation. **Local scope convention.**
