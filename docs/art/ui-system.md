# Core-screen visual system

Status: selected local design handoff for MVP-03-T04, 2026-09-24; static layout review completed. These values are implementation choices within the owner's retained companion style, not owner approval of unseen UI. No product screens, localization runtime or native accessibility acceptance are implemented here.

Scope: onboarding, Today/Oath detail, capture, pending/result, Recovery, squad/progress and settings. Accepted mechanics come from the [first-loop contract](../product/first-loop.md); screen ownership stays with MVP-04–12. This document specifies presentation, not new navigation, squad rewards or authentication choices.

## Visual quality bar

We aim for pixel-perfect presentation. A screen is not done while it has crooked, misaligned, inconsistent or visually unattractive elements. Examples: uneven baselines or spacing, sprites that jump between frames, clipped or blurred artwork, visible seams in gradients, text colliding with busy artwork, mismatched radii or tints, and stray glows or shapes that look broken. Visual defects found during native testing are fixed and re-checked in the same iteration, not deferred as notes. Judge on real devices or simulators at target sizes, including the small screen and maximum text. **Local decision: owner instruction, 2026-09-26.**

## Tokens and layout

The following are **local design choices**, dated 2026-09-24, building on the [art direction](art-bible.md) and inspected [opaque asset panels](companion-assets.md#export-metadata). Values are logical layout units; desktop studies use CSS px and are not native measurements.

| Token | Selected value / purpose |
| --- | --- |
| Canvas / surface | `#141719` / `#242a2d`; flat page and distinct content cards |
| Text / secondary text | `#ede7db` / `#b8b2a7`; all essential rules remain ordinary text, never muted through opacity |
| Primary action | `#dfac63` fill with `#141719` text |
| Neutral / positive / missed | `#a7becb` / `#a9c7a0` / `#d9a390`; status text and markers on dark surfaces, always accompanied by words |
| Font | Platform system font; body 17, line height 1.5; title 28 semibold, line height 1.2; section 22; action/label 17; metadata 15 |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32; page/card padding 16, item gap 12, section gap 24 |
| Shape | Card/control corner radius 16; no texture behind rules or action labels |
| Controls | Minimum height 48, vertical padding 12; grow with text, wrap labels and stack actions vertically |
| Artwork | Separate opaque 180 × 270 panel, `contain`, centered; no mirroring, overlaid text or cropped boots/lantern |

Use one scrolling column: screen title → rule/status content → relevant action → optional art/supporting content. Onboarding may introduce the companion before the commitment summary, but rules and confirmation remain in the same readable flow. Text has no fixed-height containers or truncation. At the 200% study setting, status/preview subheadings use the scaled body size with semibold weight (34 CSS px) to keep long Polish status words intact; the title/body still scale and no text is truncated. Large text stacks all adjacent content; decorative artwork may be omitted, informative previews move below controls with their text descriptions retained. These are local layout choices supporting the [testing strategy](../engineering/testing.md) and [asset constraints](companion-assets.md#export-metadata).

## Reusable patterns and accessibility

These are local component requirements under [engineering accessibility rules](../../.agents/rules/engineering.md), using [React Native 0.86 accessibility](https://reactnative.dev/docs/0.86/accessibility) as the implementation reference (planning research dated 2026-09-24). Device behavior remains to be verified.

- Primary action: amber filled button for the available next step; secondary action: text-labelled outlined button. Each has an explicit localized name, button role and disabled/busy state when applicable. A disabled control explains its unmet condition nearby and cannot execute its action; do not use opacity alone to explain unavailability.
- Status: short localized heading, marker plus full state name, explanatory sentence, relevant server-provided time and eligible action. Status text is not a button. Pending work includes text even when a spinner is present; avoid repeated announcements of an unchanged status.
- Choice and preference: evidence choice exposes selected state; completion declaration exposes checked state; notification switch exposes its current value. A form field has a persistent visible label and associated error text. Match accessible names to visible action wording.
- Reading order follows visual order: heading, rules/deadlines, status, action, supplementary information. Do not merge a whole card into an accessibility element that hides its actionable children. Meaningful updates and errors require understandable focus/announcement behavior, checked on iOS.
- Decorative companion images are hidden from assistive technology when adjacent text carries the message. Informative unlock images expose image role and a localized description of the visual change. Artwork never acts as an unlabeled action or the sole carrier of state. Missing image presentation retains the unlock name and description plus “Grafika niedostępna” / “Artwork unavailable”.

The status words below are the primary distinction even without color; the accompanying small marker may be static. Prior earned XP remains visible and unchanged by a miss or neutral closure. This is the accepted [resolution and progression policy](../product/first-loop.md#resolution-table), not a decorative penalty system.

| Domain/presentation state | Polish / English heading | Marker and treatment | Explanation / available action |
| --- | --- | --- | --- |
| `proof_pending` | Ocena trwa / Assessment pending | Clock, neutral | Evidence received; assessment delay preserves receipt time. Show receipt and rules; no new first-submit action. |
| `needs_more_evidence` | Potrzebne uzupełnienie / More proof needed | Document, neutral | Explain missing information, same workout, two lifetime corrections and fixed cutoff; offer correction only while eligible. |
| `review_pending` | W trakcie rozpatrywania / Under review | Magnifier, neutral | Review is not a miss. Show review context and server-provided deadline; no punishment or fabricated guaranteed verdict. |
| `fulfilled` | Spełniona / Fulfilled | Check, positive | Show awarded XP from the backend; eligible evidence upgrade remains separate from fulfillment. |
| `missed` | Niewykonana / Missed | Dash, missed | State the established reason calmly; show existing XP and an eligible Recovery offer, never a reset. |
| Linked successful Recovery | Nadrobiona / Recovered | Return arrow, positive | Original miss remains in history; linked Recovery and its separate 15 XP result are visible. Not a replacement original state. |
| `unresolved` | Nierozstrzygnięta / Unresolved | Open circle, neutral | No new XP, miss or new Recovery; already activated Recovery retains its rules. |
| `withdrawn` | Wycofana / Withdrawn | Pause bars, neutral | No XP or miss; resuming does not restore this commitment. Previously activated Recovery follows the accepted policy. |

Scheduled/active headings are “Zaplanowana” / “Scheduled” and “Aktywna” / “Active”, with neutral treatment. Review, corrections, deletion and appeals must use actual eligibility/reasons; the UI never derives a terminal outcome from an image verdict. Source: [first-loop authority](../product/first-loop.md#states-and-authority).

## Screen and action handoff

All artwork uses the [selected manifest](companion-assets.md#selected-five-level-exports). Repeated companion presence is optional decoration; a current/next unlock comparison is informative. The following arrangement and short labels are **local design choices**, preserving the [accepted bilingual copy](../product/first-loop.md#bilingual-implementation-copy-handoff) and [glossary](../product/glossary.md).

| Screen | Required content and art placement | Action labels: Polish / English |
| --- | --- | --- |
| Onboarding | “Próba Iskry / Trial of the Spark”; workout promise, both evidence alternatives, completion/receipt deadlines with committed timezone, rewards/consequence/Recovery before confirmation. Optional base companion panel in the introduction, decorative. No artwork replaces rules. | “Zobacz zasady” / “View rules”; “Złóż Przysięgę” / “Commit to the Oath” only after required choices and summary |
| Today / Oath detail | “Dzisiaj / Today”; active rule snapshot, separate completion and receipt times, current state and pause access. Optional current companion below essential content, decorative. | “Otwórz Przysięgę” / “Open Oath”; “Prześlij dowód” / “Submit evidence” when eligible; “Włącz pauzę” / “Pause” |
| Capture | “Dodaj dowód / Add evidence”; photo/record choice, selected-route criteria, private preview/crop, completion declaration and applicable timezone confirmation. No companion panel competing with proof. Explain that upload start is not receipt. | “Zdjęcie kontekstu” / “Context photo”; “Zapis aktywności” / “Activity record”; “Wybierz obraz” / “Choose image”; “Wyślij dowód” / “Send evidence” |
| Pending / result | State card above illustration; receipt/correction/review context as applicable. Existing XP and actual awarded delta distinguished. Decorative current companion only after actionable information. | “Zobacz Przysięgę” / “View Oath”; “Uzupełnij dowód” / “Add corrected evidence”; “Zobacz historię” / “View history”; “Złóż odwołanie” / “Appeal” only when eligible |
| Recovery | “Zadanie Powrotu / Recovery Quest”; original miss plus separate new-workout requirement, completion/receipt cutoffs, single attempt and 15 XP without evidence bonus. No urgency/shame artwork; optional decorative current form after rules. | “Rozpocznij Zadanie Powrotu” / “Start Recovery Quest”; “Zobacz pierwotną Przysięgę” / “View original Oath” |
| Squad / progress | “Drużyna / Squad”, “Postępy / Progress”; private group context and earned XP/current level. Current and locked-next panels stack with names, text lock status and description; level 5 shows completion with no next preview. Team mechanics remain MVP-11-owned. | “Zobacz następne odblokowanie” / “View next unlock” for levels 1–4; “Zobacz historię” / “View history” |
| Settings | “Ustawienia / Settings”; language, notification preference, pause/resume and distinct evidence/account deletion controls. No art required. Evidence deletion explains affected cases and preserves already settled XP; account deletion separately explains removal of account-linked history. Show each consequence before its own confirmation. | “Język” / “Language”; “Powiadomienia” / “Notifications”; “Wznów” / “Resume”; “Usuń dowód” / “Delete evidence”; “Usuń konto” / “Delete account”; “Anuluj” / “Cancel” |

Pausing is an equally readable available action, not a guilt prompt or demand for illness evidence. Use the accepted `pause.pending` and withdrawal explanation: reminders stop; submitted evidence and existing deadlines remain; resuming does not revive withdrawn commitments. No minimum-workout alternative is offered in this first loop. Source: [pause policy](../product/first-loop.md#pause-and-alternatives).

Capture previews contain only the player's authorized proof; squad views do not show proof images. Evidence and account deletion require their distinct accepted explanations, never a generic misleading “all data deleted” success before completion. Sources: [privacy/retention](../product/first-loop.md#review-and-retention), [security rules](../../.agents/rules/security.md).

## Informative art copy

Local descriptive copy for the selected [cumulative appearances](companion-assets.md#selected-five-level-exports); names and lock/current status remain separate visible text. No entitlement is inferred from the image.

| Appearance | Polish description | English description |
| --- | --- | --- |
| Wanderer | Żaromir, drewniany wędrowiec z żelazną latarnią. | Zharomir, a wooden wanderer carrying an iron lantern. |
| Ember Sash | Żaromir z nową wstęgą w kolorze żaru. | Zharomir wearing a new ember-colored sash. |
| Guardian’s Token | Żaromir ze wstęgą i nowym znakiem strażnika. | Zharomir wearing the sash and a new guardian’s token. |
| Oath Fittings | Żaromir ze wstęgą, znakiem i nowymi okuciami przedramion. | Zharomir with the sash, token and new forearm fittings. |
| Spark Mantle | Żaromir zachowuje wstęgę, znak i okucia. Nosi nowy, warstwowy płaszcz. | Zharomir keeps the sash, token and fittings and wears a new layered mantle. |

Use “Obecny wygląd” / “Current appearance” and “Jeszcze nieodblokowane” / “Locked” as text labels. At level 5 use the manifest's “Początkowa ścieżka ukończona” / “Initial track complete”; XP may still accumulate. A progress indicator has a localized text equivalent and accessible value based on authoritative state. Source: [initial level policy](../product/first-loop.md#initial-levels-and-unlock-ownership).

## Localization boundary and review evidence

MVP-04 owns the shared translation API, complete `pl`/`en` catalogs and locale selection. This handoff supplies copy candidates for that boundary, not a second runtime. Keep strings and accessibility descriptions outside components and artwork; use full messages, named interpolation, proper Polish plurals and committed-timezone formatting. Language switching changes neither eligibility nor deadlines. Source: [localization contract](../product/glossary.md#translation-storage-and-runtime-contract).

Artifact evidence (2026-09-24): ignored static studies in `graphics/mvp-03/ui/`, 390 CSS px width in PL and EN at 100% and 200% type. All seven screen families and eight state variants were inspected in Safari at both scales and locales, scrolling each full study. Essential text and controls remained readable without clipping or artwork overlap. Corrected missing evidence-route/declaration content, missing next-unlock preview, a broken relative image path, ambiguous account-deletion copy and awkward long Polish status-word wrapping. Informative previews remain present at 200%. This browser text-scale setting is a representative design exercise, not iOS Dynamic Type or VoiceOver acceptance.

Review evidence: static artifact inspection completed; studies have inert controls and do not exercise interaction. No live proof or account data was used. Native loading, complete feature-screen integration, PL/EN iOS layout, enlarged system text, VoiceOver focus/labels/state and interactive control behavior remain later-slice acceptance. No dummy unit tests are required for these prose/layout choices; behavioral component implementation follows the [testing strategy](../engineering/testing.md).

## Mobile implementation evidence

MVP-03-T05 implements `apps/mobile/src/ui/Action.tsx` and `tokens.ts`, using the shared MVP-04 locale provider. The diagnostic retry is its first consumer. Primary/secondary controls expose name, disabled/busy state and a nearby reason; disabled actions require a supplied reason, and busy actions default to localized working text. They prevent callbacks while unavailable and grow with wrapping text.

On 2026-09-24 an ignored isolated fixture was inspected in Expo Go on iPhone18 Pro / iOS27.0: PL/EN names/reasons, disabled and busy native accessibility states, normal and long labels. Native taps increased the counter only for available controls. A temporary body-size change17→34 demonstrated wrapping/growth and scrolling in both languages, then was reverted. This was a deliberate font-size stress check, **not** a system Dynamic Type or VoiceOver speech/focus test. Full system-text and VoiceOver acceptance remains required with feature-screen adoption (slice C). The temporary fixture entrypoint was removed; no demo UI is part of the shipped route. Source retained locally at `graphics/mvp-03/ui/native-action-preview.tsx`.

MVP-03-T06 implemented `StatusCard` for eight explicit presentation variants, with complete PL/EN catalog headings/descriptions, decorative markers, supplied context and optional supplied action. The component did not determine eligibility, change XP or substitute recovered presentation for the original domain record. A changed status posted one queued accessibility announcement, and unchanged rerenders and initial mounting did not repeat it. Local announcement choice based on [React Native0.86 AccessibilityInfo](https://reactnative.dev/docs/0.86/accessibilityinfo), checked2026-09-24. Real VoiceOver speech/focus remains slice C. MVP-22-T07 replaced it with NextCard, see below.

MVP-22-T07 replaced `StatusCard` with `apps/mobile/src/ui/NextCard.tsx`, the "now and next" card of [clarity](../product/clarity.md#now-and-next-card). StatusCard had no screen user and its `status.*` copy promised awarded XP, so the component, its test and the `status.*` keys were removed. NextCard shows the state seal and name, one line, the countdown when the state has one, at most one action, an optional secondary node and "Pełny opis" for the long facts. It keeps the queued announcement of a changed state, never on mount or an unchanged rerender.

All eight cards were visually inspected in PL/EN on the same iPhone18 Pro/iOS27.0 simulator, with separate native heading/text elements and readable wrapped copy. An Expo Go hot-reload native-module error cleared on explicit reload; no production fix was inferred. The ignored fixture is `graphics/mvp-03/ui/native-status-preview.tsx`; the temporary app entrypoint was restored. Owning screens still supply authoritative deadlines/reasons/actions and require full native accessibility review.

MVP-03-T07 adds selected companion rendering and localized current/locked-next/cap presentation; actual five-asset fixture loading and limitations are recorded in the [asset handoff](companion-assets.md#native-presentation-evidence--mvp-03-t07). Functional screens and server mapping remain later work.

## First-Oath visual implementation — MVP-05-T12

The mobile Forge hub now uses the [original hearth export](forge-assets.md), three labelled detail shortcuts and the complete ordered Today list. Large system text uses the list equivalent. Today/history navigation is compact; list and pause sections use distinct cards. Creation uses a calendar, explicit hour/minute selection and searchable timezone choices, preserving wall-time strings for server DST validation. Review separates the promise, exact time facts and every immutable rule section; both evidence alternatives remain visible. These are implemented local design choices, not owner approval of unseen screens.

A separate [development-only demo](../../apps/mobile/demo/README.md) exposes empty/returning PL/EN flows without changing production `index.ts`. It uses synthetic API/authentication and memory storage. Native accessibility and owner acceptance are recorded separately from automated checks in the T12 handoff; this implementation does not establish physical-device/provider acceptance.


Owner interaction refinement (2026-09-25): the stone/amber direction is accepted; web-style outlined actions are superseded for the shared `Action` by raised amber primary actions and unboxed secondary rows with press feedback. Oath activity choices use labelled medallions, and the interactive hearth opens creation. Short scene entrances, embers and the post-acceptance seal have reduced-motion/static and background-safe behavior. Labels, explicit consent, disabled/busy reasons and controller authority are unchanged. This is an implemented local design choice; final native/owner acceptance remains separately recorded in the [visual task](../product/oath-visual-polish.md#owner-interaction-refinement--2026-09-25).
