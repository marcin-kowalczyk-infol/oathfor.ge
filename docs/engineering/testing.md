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
| Actual solo first Oath | MVP-05-T09 component/controller wiring implements form, stored-rule review and explicit acceptance after completed onboarding; real signed-iOS end-to-end acceptance and T22 remain unchecked |

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

MVP-05-T07 pause checks cover complete affected-set revisions, inclusive S withdrawal, elapsed-cutoff reconciliation before confirmation, unchanged pending/terminal fixtures, owner isolation, repeated pause/resume and rollback. Account-first process tests cover accept/pause ordering and authorization expiry while waiting for locks. These tests do not establish actual receipt, correction, settlement or Recovery integration; those implementations must join the same serialization boundary in MVP-07–10.

MVP-05-T08 mobile tests use the canonical API catalog to detect schema drift, reject malformed policy/copy/time/state envelopes, and exercise 200/201 confirmation, structured DST errors and bounded large lists. Synthetic storage/controller tests cover write-before-send, storage failure without a request, interrupted delivery/restart, same-account token replacement, stale account/session responses and blocking a replacement confirmation until the previous identity is resolved. These injected boundaries do not establish native Keychain or live provider acceptance.

MVP-05-T09 component tests exercise completed-profile routing, chosen activity/start/deadline, no confirmation before explicit acceptance, editable choices with renewed review, DST gap/overlap recovery and pending acceptance. Stored-rule rendering covers PL/EN sections, seconds and zones, the two overlap occurrences, cutoff offset changes and unsupported-device-zone fallback. Existing account/onboarding tests remain regressions; native layout and signed-provider acceptance remain pending.

MVP-05-T10 checks cover server-ordered Today with future and overdue pending items, stored-rule detail, terminal history pagination, complete pause summaries and changed-revision review. Separate detail-loading tests cover sets larger than a list page, bounded concurrency and failure without partial confirmation. Session/navigation regressions require late responses to remain invisible and old pause completions never to leave the screen busy or unlock a newer mutation. Synthetic terminal/pending records test display only; they do not establish downstream outcomes or rewards.

## MVP-05 local verification and release gates

T11 verification on 2026-09-25, against integrated T01–T10 (`c5b438c`): the isolated API checker passed 101 unit tests / 587 assertions and 257 integration tests / 2,287 assertions, PHPStan, migrations, service checks and real HTTP. Mobile passed 313 tests in 30 suites, TypeScript and an iOS export (718 modules, approximately 1.9 MB Hermes bundle) under Node 24.21.0. Repository/whitespace checks and independent task reviews passed. An initial final Jest process exited 139 without a failing-test summary; the separate full retry passed. No application defect or root cause is inferred from that process failure.

| Acceptance area | Verified evidence and remaining limit |
| --- | --- |
| Immutable creation and tracking | API and mobile tests cover explicit acceptance, retry identity, strict DST/time resolution, owner-only reads, Today/detail/history and confirmed pause/resume |
| Activation and unknown availability | Persisted reconciliation and fixed review clocks pass boundary/race/rollback tests; no healthy-service miss, receipt processing, review closure or XP is inferred |
| Native presentation fixture | A clearly labeled DUMMY fixture uses real screens/controllers with fake API, memory storage and denied-permission adapters; typecheck and Metro compilation passed (860 modules), not visual acceptance |
| Native PL/EN walkthrough | Not verified: Device Hub / booted iPhone 18 Pro / iOS 27.0 repeatedly returned `cgWindowNotFound`, including after reconnection and a fresh Expo launch; no new visual, scrolling, reading-order, VoiceOver or Dynamic Type pass |
| New/returning, restart and expired session | Synthetic component/controller coverage and DUMMY scenarios exist; memory remount is not process restart or Keychain durability |
| Real provider/device | Still requires registered bundle ID, matching private Apple configuration, signed physical iOS build and explicit live-provider authorization; real permissions, Keychain and accessibility remain pending |
| Operational/downstream integration | Deployment timer/monitoring for `app:oath:reconcile`, finalized receipts, availability evidence, review/outcome settlement, rewards and linked Recovery remain assigned to MVP-06–10/14 |

The ignored fixture is `graphics/mvp-05/ui/native-oath-preview.tsx`. Its controls select PL/EN, new/returning setup, memory remount, expiry, offline responses, lost confirmation response and changed pause revision. It is never the production entrypoint. T11 restored `apps/mobile/index.ts` byte-for-byte and removed the temporary `.expo` copy after the attempt; no live provider, SecureStore, proof or reward adapter was used by the fixture. Resume the native matrix with an accessible simulator window, then the matching signed physical build. MVP-04-T22's implementation dependency is supplied; its signed-device acceptance remains open.

MVP-05 local implementation is complete with the explicit DUMMY native handoff; release acceptance remains pending. Passing mocks, command checks or exports cannot close the native and downstream rows above.

### MVP-05-T12 visual follow-up checkpoint — 2026-09-25

Implemented local presentation: original Forge art and up to three detail seals with full ordered list, large-text list equivalent, calendar/hour/minute and searchable timezone controls, retained uncommitted drafts, exact immutable-rule grouping, and an isolated development-only demo. Behavior-first regressions cover seal routing, literal DST input, back navigation, delayed confirmation cleanup, device-unsupported timezone fallback and accessible selected field values. Independent `oathforge-review` findings were fixed and re-reviewed without remaining actionable correctness findings.

Node 24.21.0: 32 mobile suites / 328 tests, TypeScript, iOS production export, repository and whitespace checks passed. Demo production export and non-development bundle requests are rejected. No API changes were made, so API checks were not repeated. Production `apps/mobile/index.ts` matches the pre-demo version.

Native evidence is narrower: before-change Today/form inspected via Device Hub; new empty Polish Forge inspected from an iPhone18 Pro/iOS27.0 screenshot. Full native PL/EN journeys, smaller supported viewport, system Dynamic Type/Reduce Motion, VoiceOver and owner visual approval remain **pending** after repeated `cgWindowNotFound` prevented interactive access. Follow the [demo walkthrough](../../apps/mobile/demo/README.md#simulator-walkthrough-pending-native-acceptance). Do not mark T12 visual acceptance complete from automated checks or the single empty-screen screenshot. Physical-device/Apple provider acceptance is deferred by the owner and does not block this simulator scope.

### T12 game interaction refinement — 2026-09-25

The owner accepted the stone/amber art direction and requested game-like interaction. The follow-up adds an interactive hearth, spring-loaded seals and choices, embers, scene transitions and an acceptance stamp. Motion respects the system preference and foreground state. Decorative glyphs retain fixed dimensions while meaningful labels scale. Independent review found no remaining actionable findings. Node 24.21.0: 33 suites / 332 tests, TypeScript and production iOS export passed. Production `apps/mobile/index.ts` remains unchanged.

Native DUMMY walkthrough on iPhone 18 Pro / iOS 27.0 verified PL creation, EN rule review and lost-response recovery, preserved creation choices, seal detail, 22-row history pagination and changed-revision pause/resume. A scrolled form originally opened review below its heading; the corrected scene reset was verified in English. A separate pending/error reset and seal reading-order alignment still need native recheck. Synthetic responses establish presentation behavior only.

A resumed native pass verified the large-text Forge fallback on iPhone18 Pro/iOS27.0. Mid-word tab wrapping was reproduced and fixed by vertical navigation at the existing fallback threshold; PL/EN maximum-system-text screenshots and History navigation passed. The isolated iPhoneSE3/iOS27.0 simulator (375×667) verified PL creation/calendar/time/review, visible lost-response recovery and Active confirmation, plus EN returning seals and Scheduled detail. The prior pending/error scroll-reset fix is now natively confirmed. VoiceOver enablement and AX seal activation were observed, but speech/sequential focus/error announcements remain unverified. Full accessibility and the full screen/state matrix are not complete. All main-simulator test settings were restored and verified: VoiceOver off, Reduce Motion off, Larger Accessibility Sizes off, text slider50%. Physical-device and Apple provider acceptance remain deferred.

The navigation-only follow-up passed 17 Home-screen tests, TypeScript, production iOS export, repository and whitespace checks; independent read-only review reported no actionable findings. Existing 332-test full-suite evidence belongs to the preceding implementation; it was not rerun for this layout-only change. Native visual red/green is the relevant layout check; no synthetic style assertions were added.

### T12 spatial interaction prototype

A development-only scene now starts in the demo and can be reopened through its controls. Five scene tests cover static selection/exit, interrupted completion, timer cleanup, reduced-motion settlement, large-type accessibility equivalence and suppression of walk replay after returning from background or restoring motion. Demo tests (10 total), TypeScript, production iOS export and repository/whitespace checks passed. Production code-bundle hash matches the preceding navigation export; production index is unchanged.

Native iPhoneSE3/iOS27.0 inspection verifies full room framing, PL chronicle arrival, rapid hearth→seal retarget, reduced-motion instant selection and restored walking, Back to the functional Forge, and reopening the scene in EN. Initial blank/cropped room rendering was corrected with explicit image dimensions. Independent art review accepts the assets for a labelled prototype with frame-registration compensation; independent code review found a resume replay bug, reproduced by a failing test and fixed, then re-reviewed without findings. This prototype does not establish full directional animation, VoiceOver speech, production navigation or gameplay.

### Immersive Forge demo follow-up — 2026-09-25

The isolated station scene now fills the viewport with object hotspots and arrival speech bubbles. Demo tests cover door-only external action, interrupted walks, foreground/Reduce Motion handling, bubble dismissal/reopening and ambient-loop cleanup (3suites/12tests). TypeScript and production iOS export pass; production bundle hash remains `19e81df0ab6fa0f8acc6b4a4449f0140` and contains no station prototype assets. Production entry is unchanged.

Native Device Hub checks: SE3 EN book coordinate tap → walk → bubble, dismiss and door return; tall iPhone18Pro PL exposed side cropping in v02, corrected with v03 portrait composition. Final v03 on18Pro shows the door, three seals and book; coordinate book tap/arrival and door return work. Increasing system text eight steps exposed clipped glyphs in an already-open bubble. Explicit large-text scrolling height and remounting content on font/locale/station changes fixed it: native large PL heading is readable and a drag reaches the final words. Eight decrease steps restored the starting text size, verified by normal compact text. No other system accessibility setting was changed in this follow-up. Full VoiceOver speech/focus coverage, directional animation and final owner acceptance remain pending; these demo observations do not establish production provider or physical-device acceptance.

Final v03 SE3 check also verified the full portrait room, coordinate seal selection, companion arrival and readable EN bubble.

### Companion guide refinement — 2026-09-26

Focused guide/session tests observed3failures against the previous scene, then passed; full demo4suites/15tests and TypeScript pass. Independent review found no code findings. Native SE3: PL four-step guide advances highlights from hearth through seals/book/door, final completion dismisses it, a book visit shows the same portrait/name in the ordinary bubble. DEMO replay and switching to EN reveal the first English instruction. Portrait crop and normal-size next/skip controls are visible.

Eight system text increases on SE3 produced readable large speaker text and reachable fixed controls, but scripted drag/scroll did not establish that the rest of the long first instruction can be reached. This specific large-text scrolling check remains unverified; do not count the screenshot as a pass for the whole bubble. Eight decreases restored normal text, verified visually. VoiceOver speech/focus and final owner acceptance remain pending; no other system setting or production entry was changed.

## Player character acceptance (MVP-17), 2026-09-26

Automated: API integration tests cover creation, identical and concurrent retries, the three-character limit under a worker race, invalid name and preset codes, foreign characters, switching, `character_required`, previews bound to a character, acceptance after a switch, per-character lists, cursors and pause, and the pause flag read after the account lock. Mobile tests cover strict character envelopes, name parity with the PHP vectors, durable creation retry, routing to creation, rebinding on a switch, pending acceptance per character and the creation and change screens. Final counts are in the MVP-17 task records.

Native checks used the development demo with its DUMMY runtime, so no real API, Apple sign-in or Keychain behavior was observed.

| Device and setting | Observed |
| --- | --- |
| iPhone 18 Pro, iOS 27.0, Polish | Creation with look change, live name validation (`Xy2` rejected), form choice and live preview, then Oath screens. Returning player switch from Radomir to Wiesna shows only that character's Oaths. Change screen, creation from it with its back link, one-row header badge. |
| iPhone SE 3, English | Creation layout fits, change screen, header badge stacks under the door with the chevron at the right edge. |
| iPhone SE 3, Polish, Hermes | Pasted `Żaneta O’Brien` (U+017B, U+2019) accepted, a mis-encoded paste rejected. `String.prototype.normalize` runs on every keystroke without error. |
| iPhone SE 3, Polish, largest accessibility text, Reduce Motion on | After fixes no word breaks inside a word on creation, form choices, preview card, change screen, badge and the Oath list title. |
| iPhone SE 3, lost creation reply | Pending message, dimmed locked controls and retry. Retry created exactly one character. |

Not observed natively, covered by tests where noted: NFD composition on Hermes, a pending Oath acceptance surviving a switch (tests), pausing one character and checking another (tests), creating the third character up to the limit (tests), an app restart during creation (tests), English at the largest text size, iPhone 18 Pro in English or at the largest text size, Oath rules and detail screens at the largest text size, and VoiceOver, which the owner deferred on 2026-09-26. The presets are DUMMY art. Owner visual acceptance is pending.
