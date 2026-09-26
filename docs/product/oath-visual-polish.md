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


## Owner interaction refinement — 2026-09-25

The owner accepted the stone/hearth/amber art direction and requested a more interactive game presentation, without web-style outlined buttons. This approves the visual direction, not an unseen final layout. The follow-up makes the hearth itself the creation affordance; Oaths use round metal seals with stationary hit targets and press feedback. Shared primary actions have a raised face, secondary actions are unboxed labelled rows, activity choices use medallions, and screen changes use brief entrance motion. Ember/light motion is decorative; acceptance gets a one-shot seal only after the controller supplies the accepted Oath. Foreground/Reduce Motion gating has a static equivalent. No XP or domain transition is generated by animation.

Native follow-up observations on iPhone18 Pro/iOS27.0: PL calendar/time selection and explicit acceptance; EN draft preservation through Today, full rule/evidence sections and distinct completion/receipt clocks; lost-response recovery; seal-to-detail routing; history pagination; changed-revision pause review, confirmation and resume preserving withdrawals. Native inspection exposed retained scroll position on screen changes and hidden pending feedback after confirmation; scene keys now reset those views to their heading. Paused status now precedes the artwork and creation is suppressed while paused. Seal targets share one baseline to preserve native left-to-right accessibility ordering.

### Resumed native verification — 2026-09-25

Actual maximum system Dynamic Type on iPhone 18 Pro / iOS 27.0 exposed mid-word wrapping of Today/History. Navigation now stacks vertically at the existing large-text/narrow-width fallback threshold. Native PL/EN screenshots verify complete tab labels and working History navigation without reducing essential text size.

A separate iPhone SE (3rd generation) / iOS 27.0 simulator, named `Oathforge T12 small`, supplies a 375×667 viewport. Inspected PL empty Forge, activity form, calendar/time selection, full-rule preview, lost-response feedback and recovery to Active. Recovery feedback is visible immediately at the top, confirming the earlier scroll-reset fix. EN returning Forge exposes three seals in matching visual/AX order; the middle seal opens Scheduled Mobility detail with the original times and rules. Screenshots are recorded in the session; synthetic API/authentication/storage remain DUMMY.

VoiceOver was enabled on the main simulator (first-run gesture notice and focus outline observed); AX activation of a seal opened its correct detail with accessible rule headings. Speech, sequential swipe order, error announcements and focus continuity are **not** established by that check. Complete accessibility and the full screen/state matrix remain pending, along with owner review of the running interaction. Test settings were restored and verified in Settings: VoiceOver off, Reduce Motion off, Larger Accessibility Sizes off, text slider50%. Device Hub’s Device → Accessibility text-size menu worked where direct slider gestures did not. Physical-device/provider acceptance remains deferred.

### Spatial-navigation exploration — 2026-09-25

Owner authorized a separate prototype in which rune selection sends Żaromir to a place in the Forge. Explore three destinations (hearth, seals, chronicle) with interruptible movement and local light/arrival feedback. This is an interaction proposal, not approved functional navigation. The existing Oath journey remains available separately in the development demo; no domain operation is triggered by walking. Provisional room and four-frame companion assets are documented in the [station handoff](../art/forge-stations-prototype.md). Final directional animation, occlusion and owner acceptance remain open.

### Immersive scene refinement — 2026-09-25

Owner requested the room to fill the screen, removing the permanent title/instructions and oversized rune medallions. The demo now uses a portrait room with gently glowing hearth, seals and chronicle as touch targets. Żaromir approaches a selected place; a short dismissible speech bubble appears on arrival. The moonlit door returns to the existing functional journey. The small DEMO control overlays the scene. Bubbles support scalable, scrollable text; Reduce Motion supplies a static equivalent. This remains an isolated interaction prototype with no commitment or reward operation. Full directional character animation and final owner acceptance remain pending.

The initial touch-affordance trial added a floating light and lower light arc. The owner rejected the arcs as visually broken; the follow-up removes them and strengthens the object pulse. Touch-down emits a520ms expanding light ring at the local contact point; holding a target brightens its light marker. The door uses cool light. Touch areas stay stationary; release retains the existing station/exit action. Reduce Motion disables drift/ripple and retains static press feedback. No new artwork or domain action is introduced.

### Companion introduction — owner direction, 2026-09-25

On the first visit, Żaromir introduces the four clickable places in short, skippable speech bubbles while highlighting the current destination. Touching a place remains available during the introduction. Every companion bubble carries his canonical portrait and localized name so its speaker is clear. In the isolated DUMMY demo, completion is remembered only for the current session; the demo controls allow replay. This is an interaction prototype, not persisted account onboarding or new Oath functionality.

## Illustrated screen continuation, 2026-09-26

Implemented shared room backgrounds for creation, review, acceptance, Today, history, detail and pause. Activity choices use illustrated objects and a shape-changing selection marker. Companion dialogue includes the starting portrait and localized speaker name. Rules use parchment sections while retaining every immutable sentence and exact stored deadline. Existing screen entrances and touch springs respect reduced motion. The demonstration uses diffuse alpha haze in place of solid oval lights. See [selected assets](../art/forge-journey-assets.md).

Native iPhone SE 3 / iOS 27 inspection covered PL creation artwork, selection and door navigation, plus EN Today, history, detail and pause. Review of the accessibility tree confirmed full rules and affected pause sets. Automated gestures did not establish scrolling reachability in this session, so the complete native acceptance journey, maximum Dynamic Type and VoiceOver remain pending. No device accessibility settings were changed. This is implementation progress, not final owner acceptance.

## Room navigation continuation, 2026-09-26

Owner feedback: the functional Forge could not be closed, typography felt weak and history dates were verbose. The owner also asked for a spatial entry and distinct place animations.

Implemented in the development demo. Entering the room applies a short camera approach. Touching the hearth, seals or chronicle plays its own decorative response: an ember burst, turning runes or turning pages. Arrival shows a named action in the companion bubble. Only that action opens creation, the current Oaths or history. The door opens the current Oaths. A "Return to the Forge" door on every functional screen goes back to the room. The functional app stays mounted but hidden and excluded from accessibility, so form choices and an unresolved acceptance survive the round trip. When gameplay is paused, the hearth opens the current Oaths with the pause notice, never new creation. A remounted demo app starts at its own Today and does not replay an earlier room destination.

History rows show a compact committed day and time. The accessible label keeps the full stored time and timezone. Titles, rule headings and door labels use the system serif display face. The Today title reads "Your Oaths" / "Twoje Przysięgi".

Reduce Motion skips the camera approach and place responses. Responses stop when motion is disabled and never replay on return. They never create, change or confirm an Oath. The player-character idea is recorded as a [proposal](player-character.md) only.

Native iPhone 18 Pro / iOS 27 check in PL: chronicle action opens history, the door returns to the room, and a creation choice survives leaving and reopening the hearth. The door opens current Oaths, with the demo badge below the status bar. Camera approach and place responses were seen only in still screenshots, not as frame-by-frame motion. EN, smaller screens, maximum text, Reduce Motion, VoiceOver and owner acceptance stay pending.

## Forge places continuation, 2026-09-26

Implemented in the development demo with owner-generated artwork from the [places manifest](../art/forge-places-assets.md).

Each functional screen now stands in its own place. Creation and rule review use the hearth close-up. Today and Oath detail use the seal wall. History uses the chronicle. The pause review keeps the dimmed room. Close-ups fill the screen width from the top and fade into a dark floor under the text. Opening a place from the room zooms from the room artwork into that close-up. Reduce Motion shows the close-up at once.

Every Oath row, featured seal and detail shows a shape-coded state seal next to its short state label. The detail replaces the status sentence with the seal and label, and keeps "Status: …" as the accessible label. State never depends on colour alone. Each seal has its own motif.

A looping flame burns in the room hearth and in the hearth close-up. Loops stop in the background, under Reduce Motion and while the functional app is hidden under the room. The demo marks the hidden subtree as motion-suspended, so its Forge hub, flame and entrance animations stay idle.

Żaromir walks with a sheet facing the travel direction: side views for diagonal paths, back view toward the hearth, front view when returning. He breathes slowly while standing and takes a station pose on arrival. Sheets are pre-aligned in export and never mirrored. Reduce Motion places him at once with the same pose.

The companion bubble now projects its position through the room camera zoom, so its tail points at Żaromir's feet. A hearth request that meets a busy controller without a pending acceptance shows a notice asking the player to return in a moment. It does not open creation.

Known limits: a live Dynamic Type change remounts the screen content so iOS measures text again. An open time picker closes then, while the form draft survives. VoiceOver focus order was not checked because the iOS Simulator has no VoiceOver. Native evidence covers iPhone 18 Pro and iPhone SE 3 in PL and EN, maximum text and Reduce Motion.
