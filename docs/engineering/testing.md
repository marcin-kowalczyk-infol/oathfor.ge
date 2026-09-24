# Testing strategy

Status: API kernel/liveness and real PostgreSQL/Redis integration tests, PHPStan, mobile connectivity/component tests and strict TypeScript checks are runnable. Use `python3 .agents/commands/check_api.py` for isolated API/service verification and `npm test -- --runInBand` / `npm run typecheck` from `apps/mobile`. iOS simulator connectivity acceptance passed; the updated Docker lifecycle workflow awaits a hosted run. The Docker lifecycle harness, `python3 .agents/commands/check_docker.py`, covers clean startup, managed delivery, persistent restart and bootstrap failure; see setup for its isolated scope. Product-layer checks below remain planned. See [setup](development.md).

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

## First-loop scenario handoff

The accepted [MVP-01 scenario matrix and ownership map](../product/first-loop.md#acceptance-scenarios-and-decision-record) supplies stable LOOP-01–17 and task-specific cases for MVP-05–10/14. These are artifact-reviewed expectations, not passing application tests. Downstream implementation must retain their IDs, observe behavioral red with fixed clocks/synthetic responses, then implement and verify; this follows the existing [implementation workflow](../../.agents/skills/implement-epic/SKILL.md).

MVP-03 selected original static exports in the [asset manifest](../art/companion-assets.md); MVP-03 T07 verified all five static images in a native PL/EN fixture and fixture bundle. MVP-09 still needs authoritative grants and actual feature-screen loading/display checks. Apple Fitness PL/EN fixtures and model evaluation, bilingual iOS product flows, operator authorization and provider/storage deletion/restore remain separate acceptance gates. No successful infrastructure or connectivity test substitutes for these product checks.

Apple credential boundary tests use synthetic DUMMY SDK responses for correlation, missing token/code, cancellation, unavailability and provider errors. They do not establish verified Apple identity or Oathforge sessions; see [ADR 0003](../decisions/0003-apple-sign-in.md).

The [planned authentication contract](api-contract.md#planned-authentication-contract) supplies exact challenge/session expiry, concurrent rollback, trusted-key outage and code-exchange retry cases for MVP-04. Test current-device sign-out separately from provider revocation and account deletion. The contract is artifact-reviewed design; these runtime scenarios are not implemented by the documentation task.


MVP-04 challenge acceptance uses isolated PostgreSQL for issuance, replay, exact expiry, wrong nonce, rollback, independent consumers, limits and safe failures. Database setup failures are harness failures, not behavioral red. The test runner must migrate only its test database; no reset/migration of developer data is part of validation. These tests cover the challenge boundary, not Apple compatibility or authenticated sessions.


MVP-04-T05 verifies synthetic signed identity tokens and tests independent signature/algorithm/issuer/audience/nonce/time tampering, required claim shapes, missing configuration and key rotation/cache/outage boundaries. Test code owns its temporary cache files and fake transport; ordinary tests must not call Apple. App-session exchange and signed-device provider validation remain separate acceptance gates.

Provider credential encryption tests cover randomized round-trip, altered ciphertext/nonce/key metadata/identity binding, missing/malformed private keyrings and read-old/write-current rotation. Synthetic keys are temporary test data, not deployed credentials.


Apple code-exchange tests use temporary synthetic EC signing keys, signed test identity tokens and a fake HTTP transport. They check client-secret claims/signature, native-versus-exchanged identity/nonce matching, missing refresh credentials, unavailable configuration and provider/transport error classification. Neither ordinary tests nor the isolated API checker performs a real Apple authorization-code exchange.


Account/session integration tests use synthetic verified identities, temporary encryption keys and the isolated PostgreSQL database. Cover unique concurrent account reuse, fixed exact expiry, digest-only token persistence, encrypted provider credentials, current-session logout, inactive-account denial, transaction rollback and account-lock races. Challenge expiry must be sampled again after waiting for an account lock; fixture-controlled clocks and separate database connections exercise the boundary without waiting five real minutes.


Public Apple exchange integration tests compose real signed synthetic native/provider tokens with the trusted challenge and database transaction. Cover success/account reuse, request boundaries and rate limits, failed verification without writes, consumed/expired challenge, lost-response replay, provider failure, database rollback and simultaneous exchange. Existing issuance lock tests retain exact expiry/deletion coverage; composition tests must prove failures roll back consumption with account/session/provider writes. No test contacts Apple.


Provider maintenance acceptance covers due reservations, duplicate/concurrent invocations, invalid-grant denial, unchanged fixed app expiry, safe provider outages, replacement credentials and stale responses after login/deletion. Deletion tests check immediate access denial, retry spacing, successful token removal and the seven-day purge boundary during provider failure; late responses cannot restore purged ciphertext. Transport and refresh-signature tests remain synthetic and preserve the stricter login nonce contract.


Mobile auth transport tests validate exact response objects, UUID/session/challenge values and timestamps, safe status mapping, Retry-After handling, aborted/timed-out requests and bounded payloads. They exercise header/body credential placement and redirect rejection options through injected transport. Full Jest and TypeScript checks run under the repository Node version; fake transport does not establish native networking or Apple acceptance.


Mobile session tests cover restored-token validation before authentication, persistence before login success, exact expiry, offline/pending logout, repeated retry, storage faults and generation races across login/restore/revocation. A late success must not restore authenticated state or overwrite a newer envelope. Native wrapper tests verify fixed SecureStore options; real iOS keychain accessibility and reinstall/restart behavior remain separate acceptance.


Authentication-shell checks cover available/unavailable native Apple entry, cancellation, safe retry, single in-flight attempts, logout and reauthentication states in both languages. Lifecycle integration must clean up subscriptions and ignore stale native/exchange results. The diagnostic screen retains its health checks behind an explicit development mode. Native fixture inspection establishes layout only; signed Apple authentication, device storage and system accessibility remain separate acceptance.
