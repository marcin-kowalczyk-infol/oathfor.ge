# MVP-05-T12 — Polish the first-Oath visual experience

Status: T12 implementation prepared for review on 2026-09-25. Forge, creation controls, rule hierarchy and isolated demo are implemented locally; complete native and owner visual acceptance remain pending. Layout choices below remain proposals within the accepted art direction; no unseen design is marked owner-approved.

## Goal and boundaries

A new or returning solo player can understand Today, choose an activity and times, review the commitment, explicitly accept it, and revisit its detail/history or pause, without developer guidance. The result must be usable and visually coherent on iOS in Polish and English.

This task applies the existing [visual system](../art/ui-system.md) and [art direction](../art/art-bible.md) to MVP-05. It includes interaction polish needed for those screens, not just colors. The [Oath contract](oaths.md), [first-loop rules](first-loop.md), [glossary](glossary.md) and [API ownership](../engineering/architecture.md) remain authoritative. No proof upload, AI assessment, XP grants, Recovery creation, squads, push delivery or broader onboarding redesign is added.

The current DUMMY harness has fake API/authentication, memory storage and developer controls. Its form has been observed in the simulator; the owner reported poor appearance and behavior. This is feedback, not a completed defect inventory. Begin by recording reproducible issues. Simulator display does not establish real authentication or process persistence.

## Owner direction and reference interpretation — 2026-09-25

Accepted owner preferences: simple applications with beautiful interactive graphics, referencing Duolingo and six supplied Orbit screenshots; a central graphical Oathforge with related, tappable Oaths; a game feel whose meaningful progression is driven by real-world activity. Physical-device testing is explicitly deferred by the owner. Current task acceptance is simulator-only; do not request device access or perform physical-device tests during this task.

Reference observations: Orbit uses a spacious dark canvas, restrained atmospheric glow, a prominent central illustration, strong headings, rounded cards, a clear primary action, compact bottom navigation and a detail sheet with readable rows. The supplied screenshots show appearance, not animation behavior. Duolingo is an owner reference for simplicity and game feel; no specific Duolingo screen or motion was inspected. Orbit screenshots are retained as private design references in ignored `graphics/mvp-05/references/orbit/orbit-01.png` through `orbit-06.png`; they are not app assets.

Proposed Oathforge translation:

- Make Today a **Forge hub**: an original Slavic forge/hearth, with ember light and Żaromir as its guide. Keep the established charcoal/amber identity as the starting proposal; the references do not by themselves approve a purple palette or space theme.
- Place a small set of clearly labelled Oath seals around or connected to the forge. Tapping a seal opens that Oath's detail. Connections mean membership in the player's forge, not prerequisites or invented dependencies between commitments. Use a bounded layout (proposed maximum three featured Oaths selected in server order), plus the complete ordered list underneath so additional and overdue Oaths stay reachable.
- Give each seal an activity symbol, textual state and deadline; selected/pressed feedback and a detail transition make the artwork interactive. Keep controls stationary enough to tap. At large text sizes, use the equivalent list without losing information or actions.
- Keep one prominent creation action. A compact navigation treatment may expose Today and History plus existing account controls; do not add a calendar, shop, subscriptions or unimplemented settings because the reference has them.
- Use subtle ember motion and light for atmosphere, and bounded feedback for confirmed server events. Ambient animation is decorative. Visiting, tapping or waiting must not earn XP, advance a level or imply a completed workout. Respect reduced-motion settings with a static equivalent.
- MVP-05 maps existing scheduled/active/review/withdrawn states into this presentation. Training evidence, verified outcomes and earned visual upgrades remain owned by later epics. Clearly labelled demo states are not real activity evidence.
- Detail can use a sheet-inspired presentation, with a full-height scrolling view when rules or accessibility require it. Preserve explicit consent and access to every committed rule.

The central forge is a new asset need identified by this direction: existing Żaromir panels are available, but a selected forge illustration and animation-ready layers are not. Prepare an original forge concept and an explicit asset brief during implementation: mobile-size composition, separate foreground/light/ember layers where needed, anchors and reduced-motion still. The agent can prepare the artwork; the owner need not supply an image or generator credentials. Inspect existing opaque companion panels before deciding on any new cutout/pose. Exact composition, motion and colors remain proposals for concrete visual review.

## Proposed experience

1. **Today:** use the proposed Forge hub above, with a clear title, one prominent creation action, readable scheduled/active/review cards with activity, status and committed deadline. Keep server order and timezone grouping. Provide purposeful empty, loading, offline and retry states. History and pause remain easy to find. Use the selected starting Żaromir artwork as optional supporting content, without suggesting earned progression.
2. **Create:** activity choices with obvious selection; explicit now/future activation. Replace routine raw date/time entry with an iOS-friendly date/time selection flow. Prefill timezone from the confirmed profile, show its readable name and offer explicit change through a searchable selector. Preserve local wall-time intent for server validation: a picker must not silently normalize a DST gap or choose a repeated-time occurrence. Display both server-provided occurrences when needed. A minute-based control may explicitly submit seconds `00`; review/detail still show exact committed cutoffs.
3. **Review:** visually separate the promise, activation/completion/receipt times, evidence requirements, rewards and consequences. Use short headings, spacing and readable sections. Preserve all stored rule content and both evidence alternatives before confirmation; do not replace immutable text with a newly paraphrased policy. Supplementary disclosure is possible only while keeping essential obligations visible and every rule accessible before acceptance. Show a clearly named final commitment action.
4. **Accepted/detail:** an unmistakable confirmation followed by the authoritative state, activity and deadlines; full committed rules remain available. No proof button that implies an implemented upload flow. No locally invented failure, reward or countdown-based transition.
5. **History:** compact, scannable rows, clear state names, detail navigation, pagination and useful empty/error presentation. Preserve original records and server ordering.
6. **Pause/resume:** readable explanation and full affected commitments with withdraw/preserve outcomes, explicit confirmation and a clear paused state. A changed revision requires renewed review. Resume never presents withdrawn commitments as restored.
7. **Shared presentation:** reuse tokens, Action, StatusCard and selected companion assets. Improve hierarchy, spacing, safe areas, keyboard handling, feedback and navigation consistently. Keep player-facing text in the shared PL/EN catalogs; essential information remains text rather than artwork.
8. **Demo delivery:** provide a reproducible development-only entry that starts without editing the production entrypoint. Keep a small visible demo label and move test controls away from the normal journey. Provide empty/new and populated/returning scenarios. Demo adapters must never be reachable in a production build; document which behaviors remain synthetic.

These are local task proposals based on the existing visual handoff, not new external best-practice claims.

## Files and implementation sequence

Mobile ownership: `apps/mobile/src/oaths/`, relevant shared `src/ui/` components, existing companion rendering, `src/localization/locales/{pl,en}/`, and minimal auth/navigation integration. A date/time dependency is allowed only after checking the installed Expo version and its documented compatibility. API semantics and migrations are outside scope unless a separately documented defect requires a bounded correction.

1. Audit the current native flow and record concrete issues; restore the production `index.ts` from the current demo backup before implementation, preserving unrelated changes.
2. Prepare the central forge asset brief/concept and concrete Today, creation and review layouts with existing companion art; capture PL/EN previews for owner feedback. Continue independent component work while feedback is pending; do not label unseen layouts approved.
3. Implement shared presentation and the creation/review journey, then detail/history/pause and recovery states.
4. Exercise native scenarios, fix findings, collect evidence and deliver a repeatable simulator launch. Update the visual handoff to describe the implemented result and remaining limits.

Behavior changes use focused failing tests before implementation; pure spacing/color changes require visual inspection rather than implementation-mirroring tests. Apply the existing [testing strategy](../engineering/testing.md).

## Observable acceptance

- A fresh demo player reaches preview and accepts one Oath using date/time controls without typing ISO strings or IANA identifiers. Back navigation preserves uncommitted choices; only explicit confirmation creates a commitment.
- Both locales expose the same full stored rules, both evidence alternatives, separate completion/receipt deadlines and committed timezone. Switching locale/profile timezone does not move an accepted deadline.
- Invalid/elapsed times and DST gaps have actionable feedback; repeated local times require explicit occurrence selection. These boundary cases may use deterministic test data but must not be claimed as real-provider evidence.
- Rapid confirmation and a lost response recover the same request identity. Offline/retry/session expiry cannot hide an unresolved acceptance or create a second commitment. Existing storage/account isolation behavior remains intact.
- Today, detail and paginated history reflect authoritative data. Pause displays the entire affected set; stale revisions request a new review; resuming leaves withdrawals in history.
- Inspect all screens and empty/loading/error/busy/paused states on the available iPhone simulator and a smaller supported iPhone viewport, in PL/EN. Essential labels, actions and rules do not clip or overlap; keyboard and safe areas do not obstruct completion.
- Verify system Dynamic Type and VoiceOver reading order, labels, selection, errors and focus in the simulator where supported; leave unsupported checks deferred rather than switching to a physical device. Record actual simulator/runtime/settings and any blocked checks; static text enlargement alone is not native accessibility acceptance. Basis: [existing accessibility handoff](../art/ui-system.md#reusable-patterns-and-accessibility).
- Run mobile tests, TypeScript, iOS export, repository and whitespace checks. Run isolated API checks only if backend behavior changes. Record before/after native screenshots and a walkthrough; automated passes alone do not complete visual acceptance.
- Owner can review the actual running flow. Until that review happens, report implementation/native verification separately from owner visual acceptance. Signing/provider/Keychain acceptance remains a separate gate.

## Owner inputs and access

| Input | Needed when | Existing material / default |
| --- | --- | --- |
| Visual preference and references | Supplied on 2026-09-25 | Six Orbit screenshots plus Duolingo direction; see interpretation above. No further reference request is needed to begin. |
| Selected Żaromir graphics | Already available; no upload needed | Five tracked PNG exports in `apps/mobile/assets/companion/`, with [manifest](../art/companion-assets.md). Use the starting form for this slice; do not manufacture player progression. |
| Central forge illustration and interactive layers | New production work within this task | Agent prepares an original concept and export brief; owner reviews it. Existing companion art can be reused. New font/logo is optional. Follow the [pipeline](../art/pipeline.md); existing opaque panels are not transparent cutouts. |
| Feedback on concrete previews and the running flow | Needed for owner visual acceptance | One focused review of hierarchy/style, then the actual creation-to-detail journey. This does not block preparing the proposal or implementing independent work. |
| Physical iPhone access | Explicitly deferred by owner | Do not request or test now. Use the current simulator and a smaller supported simulator viewport. |
| Apple Developer team access, registered bundle ID and signing capability | Only for a signed build and real Sign in with Apple acceptance | Configure bundle ID matching backend `APPLE_CLIENT_ID`; provide team access through the normal account tooling, not a password in chat. |
| Backend Apple configuration | Only for real provider acceptance | Confirm private provisioning of `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY_PATH`; keep the private `.p8` file outside the repository/mobile bundle. See [development setup](../engineering/development.md). Check whether configuration already exists before requesting replacements. |
| Reachable test API and authorization for real test login | Only for the real authenticated journey | Local services and synthetic adapters are sufficient for UI development. Agree on a test account/environment before live provider calls. |
| S3, OpenAI, RevenueCat, production server or artwork-generator credentials | Not needed for this task | These support other epics or optional asset production. No purchase, subscription or external upload is implied. |

Never place secrets in this document, local task records, chat or mobile configuration; supply private paths/access through the configured environment. Source: [project security rules](../../.agents/rules/security.md). No credential is a blocker for beginning this visual task.

## Current Apple access decision

No paid Apple Developer Program membership or Apple provider credentials are needed for this simulator UI task with demo authentication. Revisit membership for real Sign in with Apple provisioning and TestFlight/App Store distribution. A basic Apple Account/Personal Team and paid Program membership are different; do not imply that every signed personal-device build requires paid membership. Sources checked 2026-09-25: [Apple membership comparison](https://developer.apple.com/support/compare-memberships/), [Program capabilities](https://developer.apple.com/programs/whats-included/). Physical-device/provider acceptance remains deferred and does not block this task.


## Implementation evidence — 2026-09-25

The [Forge handoff](../art/forge-assets.md) records original artwork and interaction layers. Today has up to three stationary Oath seals in server order and the complete grouped list; large text uses the list equivalent. Creation uses a calendar, hour/minute choices and searchable timezone list without normalizing wall-time gaps/overlaps. Uncommitted choices survive a return through Today; confirmed creation clears the draft. Review/details retain every stored rule with separated promise and exact time facts. History and pause keep their original server contracts with clearer card grouping.

[Development-only demo](../../apps/mobile/demo/README.md) starts without modifying production `index.ts`. Synthetic API/authentication/memory storage remain explicitly labelled. Its production export is rejected. No backend change, physical-device test or live provider call is part of this follow-up.

Native evidence so far: existing demo Today and raw-entry form inspected in Device Hub; new empty Polish Forge rendered on iPhone 18 Pro / iOS 27.0, screenshot retained in ignored `graphics/mvp-05/ui/t12/forge-pl-iphone18pro.png`. Subsequent CUA window access returned `cgWindowNotFound` for Device Hub, Xcode and Finder. Full PL/EN walkthrough, smaller viewport, system Dynamic Type, reduced-motion settings and VoiceOver remain unverified until interactive window access is restored. Automated component coverage is not a replacement for these native checks or owner visual acceptance.
