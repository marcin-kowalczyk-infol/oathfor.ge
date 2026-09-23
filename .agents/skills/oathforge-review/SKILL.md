---
name: oathforge-review
description: Review an Oathforge diff or implementation for domain correctness, evidence security and regressions; use for requested code reviews.
---

# oathforge-review

Read repository-root docs/engineering/testing.md, .agents/rules/security.md and the affected product specification. Establish the requested diff/base before reviewing; inspect related call paths.

Check only relevant risks: server-authoritative outcomes, duplicate rewards, deadlines, recovery history, proof ownership, provider failures and subscription events. Ground findings in file/line evidence, reproduction or clear reasoning; label uncertainty. Report no findings when warranted.

Remain read-only unless fixes are requested. Do not invent passing tests. Return prioritized findings and unverified risks, separating correctness from optional suggestions.

Sources: [Messenger](https://symfony.com/doc/7.4/messenger.html#writing-idempotent-handlers), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html); project acceptance rules in docs/product/mvp.md.
