---
name: oathforge-spec
description: Specify an Oathforge feature or revise its game loop, evidence rules, recovery behavior or acceptance criteria before implementation.
---

# oathforge-spec

Read repository-root docs/product/mvp.md, docs/product/glossary.md and the relevant architecture section. Resolve paths from the Git root.

Produce a bounded specification: goal, actors, state transitions, committed rules, proof semantics, unhappy paths and observable acceptance scenarios. Mark accepted vs proposed choices. Include duplicate/retry and deadline behavior when applicable. Reuse existing terms.

Do not silently add features, choose pricing or convert a draft into an approved requirement. Save product specs in docs; business planning belongs outside docs. Update an ADR only for a significant decision within the user's scope.

Sources: project rules in docs/decisions/0001-project-foundation.md; asynchronous reliability in [Messenger](https://symfony.com/doc/7.4/messenger.html#writing-idempotent-handlers).
