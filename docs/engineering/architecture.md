# Architecture

Status: API kernel and [liveness contract](api-contract.md) implemented; other boundaries below remain planned. Stack and deployment choice: [ADR 0001](../decisions/0001-project-foundation.md).

## Boundaries

| Component | Responsibility |
| --- | --- |
| Mobile | Capture intent/proof, render state, receive notifications |
| Symfony API | Authentication, authorization, Oath rules and authoritative state |
| PostgreSQL | Durable Oaths, proof metadata, outcomes and progression ledger |
| Messenger workers | Asynchronous verification, reminders and summaries |
| Redis | Queue/cache responsibilities to be selected during scaffold |
| S3-compatible storage | Private proof objects with controlled lifecycle |
| OpenAI | Evidence assessment and constrained companion wording |
| RevenueCat | Subscription integration; backend maintains validated entitlements |

Logical modules: identity, Oaths, evidence, verification, progression, squads, notifications and subscriptions. Start as one backend with explicit responsibilities; separate services only for demonstrated needs. **Local architecture choice.**

## Monorepo conventions

- `apps/mobile` owns its mobile dependencies; `apps/api` owns Composer dependencies and standard Symfony layout. Preserve framework defaults unless a documented need justifies divergence. **Basis: [Symfony practices](https://symfony.com/doc/7.4/best_practices.html).**
- Introduce JS workspaces/shared packages only when there is something to share; a PHP/JS monorepo does not require a monorepo build framework. **Local choice, informed by [Expo monorepos](https://docs.expo.dev/guides/monorepos/).**
- Define an API contract when implementing the first vertical slice. Do not share database entities directly with mobile. **Local boundary decision.**

## Reliability rules

- Make queue handlers idempotent. Use stable business-event keys and database constraints/transactions for single reward settlement. **Basis: [Messenger](https://symfony.com/doc/7.4/messenger.html#writing-idempotent-handlers); ledger mechanism is a local implementation choice.**
- Persist deadlines; select a scheduler/reconciliation mechanism before implementation. A queue timer alone is not our durable record of an Oath. Store instants in UTC and retain the user's IANA timezone for scheduling/display. **Local reliability rule.**
- Authenticate webhook requests and deduplicate provider events before entitlement changes. Handle out-of-order delivery through reconciliation. **Basis: [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks); reconciliation design remains local.**
- Keep private infrastructure out of the mobile bundle and enforce ownership on every resource. **Basis: [Expo variables](https://docs.expo.dev/guides/environment-variables/), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).**

## Operations to implement later

One VPS is the initial target, not an availability guarantee. Before a real user rollout: define off-host backups and prove restoration, worker monitoring, queue retries/failure handling, disk alerts, secret provisioning and deployment rollback. **Local release gate.**

No load capacity, service prices, configured secrets or deployed monitoring are claimed by this document.
