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


The accepted [onboarding contract](../product/onboarding.md) is covered by API tests for account-owned partial profile writes, concurrent independent fields, completion guards/repetition, session expiry/deletion races and safe failures. Mobile tests cover confirmed-language hydration for returning accounts, explicit basic choices, restart, ambiguous-write reconciliation and stale account results. Notification permission interruption/denial checks are covered below; final completion is covered below. API/component tests do not establish completed native acceptance.


Companion introduction component/integration checks cover accepted PL/EN copy, decorative image semantics, missing artwork, failed acknowledgment, recovery and restart before/after confirmation. The next step is reached only after the server confirms the profile change or reconciliation verifies it. These synthetic checks do not establish native VoiceOver reading order or artwork layout.


Notification tests inject the native permission/Settings boundary. They cover save-before-request, skip without prompting, failed saves, denial, unavailable/provisional/ephemeral status, Settings failure, restart after saved opt-in, foreground reads and stale callbacks after logout. A durable enabled preference survives device denial and permits continuation. Expo compatibility/configuration and iOS export verify packaging, not actual OS prompts, signing or delivery.


## Account and onboarding acceptance

MVP-04-T20 integrates the final review and server-completion handoff. Synthetic tests cover success, rejected guards, ambiguous-response reconciliation, completed-account routing and late results after logout. Component/API checks establish local behavior; the rows below distinguish it from release acceptance.

| Area | Current evidence / remaining gate |
| --- | --- |
| Backend identity, sessions, profiles and completion | Isolated API checks passed through T16: 79 unit tests / 516 assertions and 151 integration tests / 1344 assertions, including real-process races; PHPStan, migrations, platform and HTTP checks passed |
| Mobile PL/EN account and onboarding | Component/controller tests, TypeScript and iOS bundle export verify the implemented flow with injected native/provider boundaries |
| Real Apple login, return, cancellation and provider revocation | Pending registered app ID, valid private provider configuration, matching signed physical iOS build and explicit live-provider test authorization |
| Device session storage and interruption | Pending real Keychain accessibility, restart/reinstall and interrupted logout checks; SecureStore mocks do not establish these |
| Notification permission and Settings | Pending physical-device enable/deny/skip, Settings return and app interruption after saved preference; no notification delivery is implemented |
| Native language and accessibility | Pending rebuilt PL/EN metadata, full-screen layout, VoiceOver reading/focus/state and system Dynamic Type; T14 window inspection failed with `cgWindowNotFound` |
| Actual solo first Oath | Blocked on implemented MVP-05 rule summary/commitment; provisional entry creates nothing, and T22 remains unchecked |

Before closing native acceptance, record a nonsecret build identifier, device/OS, date and PL/EN result for each scenario. Include new and returning accounts, restart at each confirmed step, denied permission, expired session, native revocation and companion fallback. Never include tokens, Apple codes or private account material in artifacts. This is the local acceptance workflow under the [onboarding contract](../product/onboarding.md) and [security rules](../../.agents/rules/security.md). Deployment scheduling and complete account-deletion operations remain separate MVP-14 gates.

Native spot-check on 2026-09-25 (T21, Expo Go57.0.9 / iPhone18Pro simulator / iOS27.0): the real English unavailable-Apple screen and retry rendered. A labeled, offline presentation fixture displayed basic choices, companion introduction, saved notification-denial review and provisional Trial entry in Polish and English; the base companion artwork loaded, and the synthetic Continue reached the provisional entry. These are visual/AX observations, not authenticated-flow or OS-permission acceptance. The fixture toolbar reduces the viewport; computer-use scroll/drag returned `noWindowsAvailable`, so full scroll reachability, VoiceOver and system Dynamic Type remain unverified. Earlier `cgWindowNotFound` cleared after reconnecting; an `ExpoAsset` runtime error cleared after full reload without dependency changes but recurred when hot-swapping fixture entrypoints. The native cleanup recheck is therefore inconclusive in this Expo Go environment; adapter regression tests pass.

Switching away from the real auth screen exposed an unavailable-module cleanup error: Expo's fallback listener registration can return no subscription. T23 guards that cleanup and tests the default adapter while preserving removal of valid subscriptions. Signed-device/provider gates above remain open.

## Original Oath acceptance (planned)

The [creation contract](api-contract.md#original-oath-contract) maps MVP-05 coverage to strict local-time unit tests; immutable preview/acceptance and owner-only PostgreSQL endpoint tests; duplicate confirmation, post-lock expiry, pause/activation/cutoff race tests; and PL/EN mobile Today/detail/history tests. Observe new behavioral red before implementation. Include gap/overlap, response-loss retry after policy replacement/pause, conflicting retry identities, rollback, other-account reads, overdue pending visibility and snapshot preservation after locale/template changes. Reconciliation at S must preserve eligibility; after S unknown availability opens review, never an assumed healthy-service miss.

Native first-Oath confirmation, restart, VoiceOver and Dynamic Type remain separate signed-device gates. MVP-07–10 own real receipt, review closure, reward and linked Recovery integration; synthetic states cannot close those gates. T01 contract review implements no endpoint or gameplay behavior.

MVP-05-T02 implements the pure deadline resolver: tests cover Warsaw gaps/overlaps, explicit offset validation, ordinary/UTC deadlines, the 900-second receipt window across DST, malformed calendars/fields/zones, historical second offsets and wire-range overflow. These unit checks create no Oath, authenticate no user and do not establish persistence or native acceptance.

MVP-05-T03 preview endpoint tests exercise completed-account creation, all activity choices, immutable bilingual snapshots, owner-only reads after profile/pause changes, strict request/DST boundaries, rollback, safe database outages and fresh post-lock authorization/time. Separate processes verify account/session expiry, revocation, deletion, pause and elapsed scheduled/now choices while waiting for locks. Preview creation grants no XP and creates no commitment. The rule catalog is independently reviewed for PL/EN equivalence and accepted first-loop policy meaning.

MVP-05-T04 acceptance tests cover explicit now/future commitments, owner-scoped replay after response loss, different retry identities for the same preview, conflicting payloads, superseded rules, elapsed times, locked authorization changes and transaction rollback. Concurrent acceptance must create one commitment and preserve the accepted snapshot. T06 adds actual due reconciliation to these responses; earlier T04 tests alone did not establish it.

MVP-05-T05 query checks cover immutable owner-only detail, future/overdue Today retention, terminal history, stable ordering and pagination, invalid/foreign/wrong-view cursors, strict query parsing and post-lock authorization. T06 wires due reconciliation into detail/list reads. Terminal fixture rows establish query behavior only; they do not establish implemented fulfillment, missed settlement, reward or Recovery behavior.

MVP-05-T06 uses fixed clocks for activation and inclusive S boundaries, delayed catch-up, unchanged review clocks and duplicate execution. Its command/read/replay tests verify one shared transition boundary and fresh authorization after lock waits. Review/receipt/terminal fixtures are preserved; they do not establish downstream assessment or reward behavior.
