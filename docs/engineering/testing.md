# Testing strategy

Status: API kernel/liveness and real PostgreSQL/Redis integration tests, PHPStan, mobile connectivity/component tests and strict TypeScript checks are runnable. Use `python3 .agents/commands/check_api.py` for isolated API/service verification and `npm test -- --runInBand` / `npm run typecheck` from `apps/mobile`. Native acceptance and hosted CI execution are pending. Product-layer checks below remain planned. See [setup](development.md).

Choose tests for observable behavior and failure modes, not for restating implementation. Run the relevant checks once; broaden when changes or failures justify it. **Local workflow decision: [ADR 0001](../decisions/0001-project-foundation.md).**

| Layer | High-value checks once implemented | Basis |
| --- | --- | --- |
| Domain | Deadline boundaries, immutable committed rules, recovery outcomes | [MVP guardrails](../product/mvp.md) |
| Persistence/queue | Duplicate/concurrent events, atomic reward settlement, retry after crash | [Messenger](https://symfony.com/doc/7.4/messenger.html#writing-idempotent-handlers) |
| API/security | Other-user proof/Oath access denied, upload limits, private object URLs | [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) |
| Mobile | Pending/failed upload, retry, notification navigation, readable outcome and recovery | [MVP](../product/mvp.md); local scenarios |
| Accessibility | Screen-reader names, focus and controls; avoid color-only state | [React Native accessibility](https://reactnative.dev/docs/accessibility); color rule is a local UX constraint |
| AI | Labeled regression cases and provider outage behavior | [AI plan](ai-verification.md) |
| Subscription | Forged/duplicate/out-of-order events and entitlement reconciliation | [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks) |

Use synthetic proof in automated tests; avoid storing real user images in fixtures. **Local data-minimization rule: [security](../../.agents/rules/security.md).**

For documentation changes run the repository checker and whitespace check. These cannot establish that native agent discovery or a full application workflow works.
