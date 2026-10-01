# Clarity: light screens, a visible path and Żaromir's line

Status: accepted by the owner on 2026-10-01 (parts 1 and 2 of the design, approach B), for the epic MVP-22. The Oath path decisions below were delegated by the owner the same day. Implementation pending. Applies to the whole app. The first slice is the Oath path: Today, detail, proof and the pending states. Other screen groups follow as separate tasks against the checklist below.

## Purpose

After the MVP-07 demo the owner found the screens too wordy and heavy (owner review, 2026-10-01):

1. Too much text everywhere.
2. The screens lack lightness.
3. The player does not see what is happening now and what to do next. Icons and badges should show it.
4. Details only on demand, for example "Zobacz pełny opis".
5. Żaromir should take part in the whole process, urge and remind.

Item 5 has two parts. In-app lines belong here. Push reminders belong to MVP-06 and stay out of this document. Reward clarity (what the player earns) is a separate later part, see "Later".

## Rules for every screen

Each rule names its source or is marked as a local decision. Research checked 2026-10-01.

1. **One thought per screen.** The top shows the state and one "what next" line of at most 12 Polish words. Descriptions, caveats and rules go behind one link that says what it opens, such as "Pełny opis" / "Full description" or "Pełne zasady" / "Full rules". At most two levels. Source: [NN/g, progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), [NN/g, concise and scannable writing](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/). The 12-word cap is a local decision.
2. **Moved, never deleted.** Text behind the link is the existing text, unchanged and wrapping, never cut with an ellipsis. Stored rule text keeps its accepted place ([Oath screens](oath-screens.md), decision Q1). Source: [Apple, Larger Text evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria/).
3. **One filled action.** A screen shows at most one filled primary button. Other actions use the outline or text style. Local decision, informed by [Apple HIG, buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) (not reopened during research, marked unverified).
4. **Icons carry a label.** Every state icon has a visible label of one to three words and an `accessibilityLabel`. Essential meaning is never only in a hint. Sources: [NN/g, icon usability](https://www.nngroup.com/articles/icon-usability/) (search summary, unverified), [React Native accessibility](https://reactnative.dev/docs/accessibility).
5. **Shape, not only color.** Each state differs by shape. Neutral states (assessment, review, unresolved, withdrawn) are never red. Source: [WCAG 2.1, 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) (search summary, unverified). Neutral color for neutral states is a local decision following [first loop](first-loop.md) "review is not a miss".
6. **Progress comes from the server.** The step track and the "what next" line derive only from server state and the device's own proof record. No time is promised that the server cannot keep, such as when an assessment ends. Source: [NN/g, status trackers](https://www.nngroup.com/articles/status-tracker-progress-update/). The backend authority rule is accepted in [MVP](mvp.md).
7. **Żaromir: one acknowledgment and one next step.** At most two short sentences. Several lines per situation, chosen stably so the text does not change on every refresh. Sources: tone in [companion brief](../art/companion.md) "Starting tone", rotation following [Yancey and Settles, KDD 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf).
8. **Support, never shame.** Żaromir does not urge a workout while paused, during review or after an illness disclosure. He never puts a missed result first and always offers a next step. Sources: [pause contract](first-loop.md#pause-contract), [companion brief](../art/companion.md), [Deci, Koestner and Ryan 1999](https://doi.org/10.1037/0033-2909.125.6.627) (praise raises interest, controlling rewards lower it), [Silverman and Barasch 2023](https://www.insead.edu/faculty-research/publications/journal-articles/or-track-how-broken-streaks-affect-consumer) (a shown break lowers later activity).
9. **Polish first.** Short labels are written in Polish first and get about twice the width of their English form. Both languages are checked at 200% text. Source: [W3C, text size in translation](https://www.w3.org/International/articles/article-text-size).
10. **Unchanged rules.** Plain action labels such as "Prześlij dowód" / "Submit proof", no lore names for core actions ([glossary](glossary.md#language-and-naming-rules)). No em dash and no semicolon. Controls at least 44 pt. Reduce Motion and the simple layout keep static equivalents.

## Shared pieces

All three are built on existing components (`StateSeal`, `CompanionBubble`, `Action`, `CountdownChip`). The card `NextCard` replaced the unused `StatusCard` (MVP-22-T07). No API change.

### Step track

Four steps: **Przysięga / Oath**, **Trening / Workout**, **Ocena / Assessment**, **Wynik / Result**. Each step has an icon and a one-word label.

- Done step: filled seal shape.
- Current step: highlighted, with an optional badge.
- Future step: hollow ring.

Horizontal by default. In the simple layout and at large text it becomes a vertical list. VoiceOver reads the track as one sentence, for example "Etap 3 z 4, Ocena" / "Step 3 of 4, Assessment". The badge words, or the decided state on the result step, show under the current step and end the sentence, for example "Etap 2 z 4, Trening, Nie dotarł". A step label shrinks a little and then takes a second line, never an ellipsis.

| Server or device state | Current step | Badge | "What next" line | Primary action |
| --- | --- | --- | --- | --- |
| `scheduled` | 1 Oath | none | start time | none |
| `active` | 2 Workout | none | proof by D | Submit proof |
| `active` with an interrupted upload on the device | 2 Workout | "!" | proof did not arrive | Send again |
| `proof_pending` | 3 Assessment | hourglass | result will appear here, no time | none |
| `needs_more_evidence` | 3 Assessment | "?" neutral | more evidence needed (flow in MVP-08) | none |
| `review_pending` | 3 Assessment | scales | not a miss, review closes at time | none |
| `fulfilled`, `missed`, `unresolved`, `withdrawn` | 4 Result | result seal | result and date | none |

A `withdrawn` Oath stopped before step 2 shows steps 2 and 3 as skipped, not done. A `missed` result keeps a neutral next step from Żaromir.

### "Now and next" card

The state seal and state name, one line of at most 12 words, the countdown chip when the state has one, at most one filled button and the "Pełny opis" / "Full description" link that opens the existing long text.

### Żaromir's line

A small bust and a bubble with one line from a pool for the situation. No line while the character is paused. In review only one neutral sentence. The line never hides a required fact.

## Oath path decisions

The owner delegated these choices on 2026-10-01 ("work without further approvals until satisfied"). They come from the council review (UX, mobile, behavioural and content roles) and stay open to owner review.

1. **Scheduled.** Step 1 is done and the track shows a waiting badge. Nothing is highlighted as a task until the start. The line names the start time.
2. **Interrupted upload.** The "!" badge is amber, never red, with the label "Nie dotarł" / "Not received". A network failure is not the player's fault.
3. **Length cap.** A "what next" line has at most 12 Polish words and about 70 characters. A required refusal or error sentence is exempt from the word cap but keeps two sentences at most. Times in the line use one short form, the day with its time, such as "czw 29 paź 02:30". The caps are measured with that form at its longest. In the hour that repeats when summer time ends the line adds the offset, such as "(UTC+02:00)", and may exceed 70 characters (local decision, MVP-22-T09).
4. **Honest steps.** A terminal Oath with no proof shows steps 2 and 3 as skipped, drawn as a dashed ring. A withdrawn Oath that never started does the same. An Oath that went to review without a received proof shows step 2 as skipped too.
5. **Silence when unsure.** Żaromir is silent while paused, while the pause flag is unknown (except for scheduled and active Oaths, which a pause always withdraws, see [pause decision table](first-loop.md#pause-decision-table)), for `needs_more_evidence` until MVP-08 gives it a next step, and while a proof is being sent. In review he says one neutral sentence.
6. **Urging windows.** He urges only in three cases: less than one hour before D, between D and S (send only if the workout finished by D), and an interrupted upload before S. Everywhere else he gives a fact or a calm next step. After S the card line says the proof window has closed and offers no action until the server settles the state (local decision, review of 2026-10-01). A copy already waiting on the device keeps "Wyślij ponownie" with the calm interrupted line and a silent Żaromir, because the server answers a recorded submission with its receipt at any time and refuses an unrecorded one honestly (local decision, review of 2026-10-02). Sources: [Miller and others 2007](https://doi.org/10.1111/j.1468-2958.2007.00297.x) (controlling words raise reactance), [Gollwitzer and Sheeran 2006](https://doi.org/10.1016/S0065-2601(06)38002-1) (a when and where plan helps), [Breines and Chen 2012](https://doi.org/10.1177/0146167212445599) (self-compassion after a setback raises motivation to improve).
7. **After a miss.** The fact sits on the card. Żaromir offers a new Oath when the player wants one. Recovery is not offered until it exists.
8. **Rotation.** Frequent situations have four or five lines, rare ones two or three, review and the interrupted upload exactly one. The same Oath in the same situation shows the same line on the same local day.
9. **Today rows.** No full track on a row. A row shows four small pips with the short state label, the short deadline and the countdown chip. When a row has an interrupted upload, "Wyślij ponownie" is the only filled button on the screen.
10. **History rows.** Each row gets the short visible state label, following rule 4. This replaces the earlier "no further text" line in [Oath screens](oath-screens.md) section 5.
11. **Detail.** Order: emblem, title, step track, "now and next" card, Żaromir's line, then one "Zasady Przysięgi" / "Oath rules" link that opens the promise, the rule cards and the full stored rules together. Facts that sat in the status panel (receipt time, review end, closing time, reasons) move behind "Pełny opis" unless they are the "what next" line itself.
12. **Proof screen.** One scroll with three numbered steps: type, image, confirm. A finished step folds to a one-line summary with "Zmień" / "Change". It shows a compact step badge, not the full track. Visible lines: one privacy line under the image step, the declaration with its checkbox (it is what the player accepts) and one short line about what AI assesses. The full crop note, the full AI caveat and the committed evidence rules move behind links. Simple layout and Reduce Motion show the three steps expanded.
13. **Confirmation after the seal.** Track with step 1 done, the large countdown, one merged line with state, deadline and zone, then Żaromir's line and the actions.
14. **Facts never live in a bubble.** Pause notes, refusals and interrupted uploads are card lines. Żaromir's bubble only adds tone.

## Later

- Remaining screen groups against the rules above: main menu, Settings, character, onboarding, sign-in, Forge room dialogues. One task each.
- Reward clarity: show the reward from the snapshot before and after the result. Depends on MVP-09 for granted XP.
- Push reminders and urging by Żaromir outside the app: MVP-06.
