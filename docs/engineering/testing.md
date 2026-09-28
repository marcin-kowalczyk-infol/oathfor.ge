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

Process race tests take the contested lock in the test transaction before starting a worker. They then wait through `LockWait::assertWorkerWaiting` in `apps/api/tests/Fixtures/LockWait.php`. The helper first waits up to 30 s for the worker's backend PID line, then up to 10 s for an ungranted row in `pg_locks`. Lock workers use its 60 s process timeout. Do not poll `pg_stat_activity` from inside the test transaction. PostgreSQL collects that session list on the first request in a transaction and keeps it until the transaction ends, so a worker that connects later stays invisible. `pg_locks` reads the lock manager on every query. **Source: [PostgreSQL 17 statistics views](https://www.postgresql.org/docs/17/monitoring-stats.html#MONITORING-STATS-VIEWS), [pg_locks](https://www.postgresql.org/docs/17/view-pg-locks.html). Local decision: budgets from MVP-04-T24, where PHP and Symfony worker boot took 4 to 6 s on a CPU-starved Docker host, 2026-09-26.**


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

## Starter presets and build acceptance (MVP-17-T13), 2026-09-27

Automated: API unit and integration tests cover the six-starter catalog, a missing, extra or unknown build as `invalid_request`, a replay with another build as `idempotency_conflict`, the build in create, list and activate, and the migration setting existing characters to `thin`. Mobile tests cover build validation in the client, pending creation version 2, the controller, the creation build choice in row and stacked layouts, and art lookup by preset and build.

Native checks used the development demo with its DUMMY runtime in Expo Go on iOS 27.0.

| Device and setting | Observed |
| --- | --- |
| iPhone 18 Pro, Polish | Creation shows starter 01 thin, switching to "Tęga" changes the figure and every portrait. Returning player menu card for Radomir (starter 02 thin) and Wiesna (starter 03 heavy), change screen portraits. |
| iPhone SE 3, Polish and English | Build cards side by side fit ("Wątła", "Tęga", "Slight", "Stout"). Creating Mira with "Stout" reaches the menu with the heavy figure inside the card. |
| iPhone SE 3, largest accessibility text | Build cards stack like the title cards without a word broken inside. Stacked menu card figure fits. |

Owner visual acceptance of the starter art remains pending.

## Main menu acceptance (MVP-18), 2026-09-26

Automated: API integration tests cover `total` for Today and History, per character, after reconciliation and unchanged by pagination. Mobile tests cover the strict `total` validation, the menu summary and its refreshes (menu entry, foreground, Oath confirmation, pause change), the home route reducer, the room with guide storage, the menu, Settings, the pause review and the routing through `AuthScreen`. The full mobile suite passed with 58 suites and 706 tests.

Native checks used the development demo with its DUMMY runtime in Expo Go 57.0.9 on iOS 27.0. No real API, Apple sign-in, Keychain or notification permission prompt was observed.

| Device and setting | Observed |
| --- | --- |
| iPhone 18 Pro, Polish | Menu card for Radomir with 3 current Oaths. First room entry starts the four-step guide. Hearth leads to creation, date, time, rules and confirmation. The room door returns to the menu. Seals open Today and an Oath detail. Change character to Wiesna, then the demo "add Oath" control gives 0, 1, 2 and 5 with the Polish forms `bieżących Przysiąg`, `bieżąca Przysięga`, `bieżące Przysięgi`, `bieżących Przysiąg`. Radomir shows 3 and 4 with `bieżące Przysięgi`. |
| iPhone 18 Pro, English | Language switched in Settings survives "Restart interface". Notifications toggle. Pause review, confirmation back to Settings, the menu adds "Character paused" and the hearth then shows the pause notice. Tutorial replays the guide. A lost acceptance reply gives the Forge subtitle "An Oath awaits confirmation", and the Forge resumes the check. A new character from the change screen returns to the menu with its card. Sign-out reaches the sign-in screen. |
| iPhone 18 Pro, English, largest accessibility text, Reduce Motion on | Stacked card, full-width tiles, Settings, pause review. Simple layout: the Forge opens Today with "Back to menu". |
| iPhone SE 3, Polish, first run | "Nowa Kuźnia · pusta": character creation, menu with 0 current Oaths, guide on the first room entry, hearth and chronicle bubbles, creation with date and time, rules, and a lost reply ending in the menu subtitle "Przysięga czeka na potwierdzenie" with 4 current Oaths after the check. Change character opens from the card and back returns to the menu. |
| iPhone SE 3, Polish, largest accessibility text | Stacked menu, simple layout Forge to Today, plain "Wróć do menu" in Today and in creation, Settings and pause review after the fixes below, without a word broken inside. |
| iPhone SE 3, Polish, extra-extra-large text, Reduce Motion on | Row card, static guide, seals bubble and its action to Today. |
| iPhone SE 3, English | Menu with the pill inside the text column, guide, hearth bubble, Tutorial replay, Settings. Switching back to Polish in Settings survives "Restart interface". |

Defects found natively and fixed, each with a failing test first unless noted:

| Defect | Fix | Evidence |
| --- | --- | --- |
| Room bubble clipped at the bottom on SE 3, cutting the guide text and the station action. Not demo-only: at the full 667 pt height the guide needs about 194 pt and the old layout left 180 pt. | A bubble taller than the space under its place grows upward, never above the station touch areas. | Two `ForgeRoom` tests failed with bubble bottoms of 616 and 628 pt against a 583 pt limit, then passed. Rechecked on SE 3. |
| Simple-layout Oath creation showed the room door picture beside "Back to menu". | New plain `BackLink`, shared by the simple-layout Oath header and creation. | The font scale 2 case expected no door picture and found one, then passed. Rechecked on SE 3 at the largest text. |
| No test for the menu summary refresh after an Oath confirmation. | New `HomeRoutes` test. | Written after the code, so checked by mutation: removing the refresh made it fail. |
| English menu Tutorial subtitle used the Polish spelling "Żaromir". | "Zharomir guides you", shorter so the tile keeps its lines. | New catalog test failed, then passed. |
| Polish words broken inside at the largest text on SE 3: "potwierdzen/iem" in the pause review bubble, "Potwierd/ź" in the confirm button, "Zapamiętam/y" in the Settings note, one word per line in the pause review cards. | New `tokens.maxScale.inset` 2.5 for text in buttons, bubbles and cards. The bubble speaker name uses the display cap. | Four tests failed with an uncapped size, then passed. Rechecked on SE 3. |
| English "Change character" pill ran past the text column to the card frame on SE 3. | The pill is limited to the column width, so its one-line label shrinks. | Menu test failed, then passed. Rechecked on SE 3. |

Image defect, fixed on 2026-09-27 (MVP-18-T11): on the 18 Pro the Oath creation backdrop sometimes showed the state seal sprite sheet instead of the hearth close-up, and the bubble avatar sometimes showed another texture. Expo Go showed it in 4 of 4 attempts. Cause: React Native 0.86.3 on iOS reuses an unmounted image view for another image, and a response of the old request that is already queued on the main thread overwrites the new image ([react/react-native issue 58667](https://github.com/react/react-native/issues/58667)). The upstream fix 53bf98b is backported as a patch and compiled from source in a development build of the demo. See [ADR 0006](../decisions/0006-react-native-image-patch.md) and the [build steps](development.md#demo-development-build-and-react-native-patch).

| Build on iPhone 18 Pro, iOS 27.0, Debug, images served by Metro | Path: returning player, enter the Forge, close the guide, hearth, "Ukształtuj Przysięgę" | Result |
| --- | --- | --- |
| Development build with the patch | 6 runs, each in a new app process | Hearth close-up and Żaromir avatar in 6 of 6 |
| Same build without the patch (control) | 3 runs, each in a new app process | Seal sheet backdrop in 3 of 3, wrong avatar in 1 of 3 |
| Fresh `npm run demo:build-ios` with the patch and `ios.enableSceneSupport` | 3 runs, each in a new app process | Hearth close-up and Żaromir avatar in 3 of 3 |

Results were read from screenshots and a pixel comparison of the backdrop and avatar areas against the first correct run. Apart from the Expo Go overlay button and the animated hearth sparks, the patched screen showed no difference from the Expo Go screen above a small per-pixel threshold. The development build shows a LogBox notice for the deprecated `SafeAreaView`, which is development-only. `scripts/reactNativePatch.test.js` failed 5 of 5 before the patch and passed after it. Not verified: a Release build with bundled images, because the demo rejects production bundles and the production app needs real sign-in, and physical devices.

Not observed natively: VoiceOver (deferred by the owner on 2026-09-26), the real notification permission prompt and "Open iOS Settings", session re-validation after a background return, drafts and a language save across a background return, guide storage in SecureStore (the demo keeps it in memory), counts above 5 in Polish (tests only), real API, Apple sign-in and Keychain. Presets, room and menu art are provisional or DUMMY. Owner visual acceptance is pending.

## Tutorial acceptance (MVP-19), 2026-09-27

Automated: catalog tests compare every tutorial string with the accepted copy tables in both languages. Mobile tests cover the chapter data, the room tutorial (choice, walk, counter, another place, heard marks, the door chapter, finish after four places, ×, restart, priority over the guide, Reduce Motion, bubble limits), the tutorial screen, the home route reducer, the routing through `HomeRoutes` and `AuthScreen`, and Polish typesetting of single-letter words. The full mobile suite passed with 64 suites and 759 tests.

Native checks used the demo development build (`npm run demo:build-ios`, ADR 0006) with its DUMMY runtime on iOS 27.0. Images were correct in every run.

| Device and setting | Observed |
| --- | --- |
| iPhone 18 Pro, Polish | Menu subtitle "Żaromir wyjaśni zasady". Tutorial: Żaromir walks into the room and stands above the intro bubble, every chapter of the hearth, seals, chronicle and door with counter and stable button, heard badges, "Inne miejsce", "Zakończ" and the closing bubble, × and the door back to the menu. |
| iPhone 18 Pro, English | Menu subtitle on two lines beside Settings, the longest line `seals.3` and "Another place". |
| iPhone SE 3, Polish and English | Tutorial intro, the longest seals line, door chapter in the doorway. First-visit guide with the new door line. |
| iPhone SE 3, Polish, largest accessibility text | Tutorial row in the simple menu, tutorial screen with all chapters, no word broken inside, middle dot at a line end. |
| iPhone SE 3, Polish, Reduce Motion on | No camera move, Żaromir placed at once, door chapter, × and the door to the menu, then a room entry without the guide. |

Defects found and fixed, each with a failing test first unless noted:

| Defect | Fix | Evidence |
| --- | --- | --- |
| At the tutorial start Żaromir stood at the room entrance behind the intro bubble, and the tail pointed at empty floor. | He walks to a tutorial place in front of the hearth (0.5, 0.66). | Walk target test failed, then passed. Rechecked on both devices. |
| The door foot point (0.27, 0.58) stood Żaromir on the seal pedestals and covered the seals heard mark. | Door foot point in the doorway (0.19, 0.50). | Walk target test failed, then passed. Rechecked. |
| The heard check mark faded into the hearth glow. | A gold badge beside the place mote. | Visual only, rechecked on the 18 Pro. |
| Polish lines ended with a single-letter word ("nie zegar w", "termin z"). | Non-breaking space after a, i, o, u, w, z in Polish, in the room bubble and on the tutorial screen. | Typography, room and screen tests failed, then passed. Rechecked on both devices. |
| A line that raised the bubble moved the next button between lines, so a quick tap skipped a line. | Tutorial bubbles keep their bottom edge. | Paging test failed, then passed. Rechecked. |
| A closed tutorial started again when the routes remounted, for example after a background return. | The room reports the end, the route clears the id. | Reducer, room and remount tests failed, then passed. Found in the MVP-19-T05 review, not natively. |

Open for owner visual acceptance: on iPhone SE 3 the longest lines (`seals.3`, `door.3`) raise the bubble over Żaromir's legs. Holding the bubble below his feet was tried and hid half of the text behind a scroll, so whole text was kept. The tutorial screen intro line asks the player to touch a place, which that screen does not offer, because the spec keeps the room copy.

Not observed natively: VoiceOver (deferred by the owner), a background return during a tutorial, English at the largest text, a Release build and physical devices. Presets and room art are provisional or DUMMY.

## Forge motion acceptance (MVP-18-T12), 2026-09-27

Automated: tests cover the sprite cell math, crossfading loops and stepped sequences, the eight-direction choice and walk time, frame timers for walk, idle, pose, turn and talk, the depth size without a transform, the sheet handover while a new sheet loads, one timer for all candle flames, place responses on arrival and on a repeated touch, the three seals from one timing, the door response in the tutorial, and Reduce Motion stills. A new target mid-walk and a finished or reduced-motion response leaving nothing drawn are covered too. The full mobile suite passed with 67 suites and 811 tests.

Native checks used the demo development build with its DUMMY runtime on iOS 27.0, on the iPhone 18 Pro only (owner instruction, 2026-09-27). Motion was read from screen recordings frame by frame.

| Observed | Result |
| --- | --- |
| Walks start to seals, hearth, chronicle and door, returns and chronicle to seals | Direction sheet matches the path, steps visible, no empty or double frame at a sheet change |
| Station poses | Back to the fire with the poker, lantern to the seals, reading at the lectern, lantern into the doorway |
| Place responses | Hearth flare, three seals lit in turn, one page turning over the book, moonlight mist from the doorway |
| Tutorial | Explain and point gestures while choosing, pose, turn and talk at a place, door chapter with mist |
| Ambient | Candle and lamp flames blend with the room, wisps above the seals and the chronicle |
| Hearth close-up | The 8-frame flame burns inside the arch opening |

Defects found and fixed, each with a failing test first unless noted:

| Defect | Fix | Evidence |
| --- | --- | --- |
| A screen blend on the clipping view drew black boxes around every flame. | The blend sits on an unclipped wrapper, and flames render without a group wrapper. | Visual only, rechecked. |
| A transform scale for depth blurred Żaromir. | Depth changes the drawn size, anchored at his feet. | Depth size test failed, then passed. Rechecked sharp. |
| The place response played while he was still walking. | It plays when he arrives. | Door response test failed, then passed. |
| The page was smaller than the book and did not follow its tilt, and a runtime rotation made it blink. | Page 0.13 of the room width, tilt baked into the export, first and last frames fade. | Visual only, rechecked. |
| A repeated touch made the page blink every other frame. | Each touch mounts a fresh response. | Replay test added, rechecked by recording. |
| In the doorway he stood in front of the seal drums, and the door mist lit only the drums. | Seal drums cut from the room over him, mist moved to the doorway floor, seal glow repeated over the cut. | Visual only, rechecked. |
| The last frame of the flare, the third seal and the mist stayed at half opacity after the response. | The last light frame fades out by the end of the response. | Four response tests failed, then passed. Found in review. |
| A new target mid-walk started from the old destination, so size and direction jumped. | The new walk starts from his computed place on the walk curve. | Redirect test failed, then passed. Found in review. |
| In the hearth close-up the taller flame rose above the arch. | Flame width 0.24 of the screen. | Visual only, rechecked. |
| The first walking frame was empty, then showed two figures for one frame. | The last frame stays under a loading sheet, the new sheet shows when loaded or after 300 ms. | Handover and fallback tests failed, then passed. Rechecked at 30 fps. |

Not observed natively: iPhone SE 3 and other sizes, English, Reduce Motion, the largest text, VoiceOver (deferred by the owner), a Release build and physical devices. The art is provisional and awaits owner visual acceptance.

## Forge scene acceptance (MVP-20), 2026-09-28

Automated: tests cover the stand spots and the no-overlap rule at 375 × 667 and 440 × 956, the start point above a short panel, routing around the seal pedestals, the walker's legs and mid-walk start, the player figure (pilot sprites and still DUMMY figure), live depth order and the per-figure seal cut, the tutorial and guide spots, the dialogue panel (typing by grapheme, first touch completes, rune, fixed bottom edge, large text scroll, bust swap, Reduce Motion, 44 pt controls, painted frame), player lines by form, the hint and statistics card with owner-bound counts, the place responses from one timing, the camera flight with its 700 ms limit and the return, the door visit, and the flown route fields. The full mobile suite passed with 75 suites and 938 tests.

Native checks used the demo development build with its DUMMY runtime on iOS 27.0, on the iPhone 18 Pro only (owner instruction, 2026-09-27), in the returning player scenario (Radomir, pilot `starter_02` thin, 3 current Oaths, 22 chronicle entries).

| Observed | Result |
| --- | --- |
| First-visit guide | Żaromir walks to his spot beside the hearth and talks, the player stands at the start above the panel |
| Visit to the seals | The player walks back left, handles the seals, speaks first, then Żaromir's line and the action |
| Flight into the seals | The room zooms, the close-up takes over, Today opens |
| Return from Today | The room returns with the player at the seals and Żaromir aside |
| Talk with Żaromir | "Masz bieżące Przysięgi: 3", card with Obrońca Przysięgi, Wątła, 3 bieżące Przysięgi, 22 wpisy w kronice, matching the menu and the demo data |
| Door visit | The player walks around the pedestals, looks out of the doorway behind the drums, Żaromir's door line, the pull back opens the menu |
| Tutorial | Żaromir at his tutorial place with the ring, both walk to the chronicle, the player reads at the lectern, masculine line "co zrobiłem" |
| English | Menu, controls and the hearth visit ("This fire burns hot."), the player stirs the fire |

Defects found and fixed, each with a failing test first unless noted:

| Defect | Fix | Evidence |
| --- | --- | --- |
| At the start point the player stood behind the guide panel. | Start point (0.63, 0.74), clear of Żaromir's tutorial place. | Start point test failed at 402 × 769 and 402 × 874, then passed. Rechecked. |
| The step counter and × sat on the painted braid. | Controls and × inside the painted band. | Placement test failed, then passed. Rechecked. |
| The rune showed as a dark square. A screen blend inside the panel drew its black background. | Rune exported with alpha from its brightness (`export-rune-alpha-v01.py`), drawn without a blend. | Rune test failed, then passed. Rechecked. |
| The panel stayed over the room during the camera flight. | The panel leaves when the flight starts. | Flight test failed, then passed. |
| The return started on dark frames while its close-up decoded. | Every close-up is decoded early and kept invisible. | Preload test failed, then passed. |
| From the seals to the door the player walked over the seal pedestals. | Walks that would cross them turn at a waypoint beside their right end. | Routing and two-leg walk tests failed, then passed. Rechecked. |
| The speaking ring was invisible on the lit floor. | The ring is the warm haze image under the speaker. | Visual only, rechecked. |

Not observed natively: Reduce Motion, the largest text and simple layout, hints for 0, 1 and 5 Oaths and the paused state, every walk direction in a recording, the 700 ms limit by frame count, the other 11 player figures (DUMMY still figures, later slice), iPhone SE 3 and other sizes, VoiceOver (deferred by the owner), a Release build and physical devices. The pilot sprites, the painted panel and the responses await owner visual acceptance.

### Demo feedback fixes (MVP-20-T16 to T20), 2026-09-28

The owner's demo review asked for three changes to the scene: the player's bust hid behind the panel, the talk with Żaromir needed one touch and a visual answer, and the book looked like pages falling out. The talk rows above record the earlier two-step talk and card.

Automated: both busts are drawn after the painted frame and end above the text, one touch gives Żaromir's hint and two counters, the hint follows refreshed counts, the 2000 ms wait and the refresh started by the touch, unknown counts read "Liczba bieżących Przysiąg nieznana" and "Liczba wpisów w kronice nieznana", the catalogs no longer hold `room.player.talk`, and the chronicle turns one page in 440 ms before the signs rise. The full mobile suite passed with 75 suites and 945 tests.

Native checks on the iPhone 18 Pro, iOS 27.0, demo development build, returning player scenario:

| Observed | Result |
| --- | --- |
| Player line at the chronicle (PL) and the hearth (EN) | The whole medallion stands above the frame, clear of the × and the text |
| First-visit guide | Żaromir's painted bust over the frame, its soft lower edge on the braid |
| One touch on Żaromir (PL) | "Twoje Przysięgi czekają przy pieczęciach.", seal counter 3, chronicle counter 22, matching the demo data |
| One touch on Żaromir (EN) after "Add demo Oath" | "Your Oaths are waiting at the seals.", 4 current Oaths, 22 chronicle entries |
| Chronicle touch, video at 30 frames per second | One leaf lifts on the right, stands, lands on the left, then the signs rise. No clasp, the lectern stays visible |

Defect found and fixed: the Polish counter label broke as "wpisy w / kronice". The label now keeps the single-letter word with the next one. The test failed first, then passed, rechecked natively.

Not observed natively: the counters at large text, the waiting state with "…", the unavailable hint, Reduce Motion for the page turn, iPhone SE 3 and VoiceOver. The menu still showed 3 current Oaths right after "Add demo Oath" while the room showed 4, a menu refresh timing outside this change. The page turn, icons and busts await owner visual acceptance.
