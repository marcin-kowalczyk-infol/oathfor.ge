# Engagement: less reading, more tending

Status: specification, 2026-10-02, for the epic MVP-22 (follow-up slice E). The owner chose to implement the ranked opportunities of the engagement research from the fastest to the longest (owner decision, 2026-10-02 evening). The owner did not answer the open design questions, so the choices marked **delegated decision 2026-10-02, owner review pending** were made for the owner and stay open to review. E1 is implemented locally in MVP-22-E1.1 to E1.5 (ab6fa18 to 5010d79), with its native check and owner review pending, see [Engagement acceptance](../engineering/testing.md#engagement-acceptance-mvp-22-slice-e). E2 to E6 are not implemented. The task plan lives in the ignored `.local/epics/MVP-22.engagement.md`.

## Purpose

Owner feedback, 2026-10-02:

1. Too much text, too few visuals.
2. The game should hold attention like a tamagotchi egg, by needing something from the player, not by making the player read.
3. The rules review has "too much going on".
4. Proof submission is "too app-like". Żaromir or an oracle such as Światowid should inspect the proof visually.

The research report `.local/research/MVP-22-engagement-research.md` (ignored, 2026-10-02) ranks seven redesign opportunities. This spec covers six of them in the owner's order, from the fastest to the longest. Opportunity 7, character growth with XP, is blocked by MVP-09 and stays out, see "Dependencies".

## Sources and evidence labels

The research checked its sources on 2026-10-02. This spec did not reopen them, except the two marked "opened for this spec". Each citation keeps the research label: **opened** means the research read the page, **search summary** means only a summary was seen and the claim is unverified.

## Goals

- **Fewer words.** Every screen state has a measured word budget, see E1.
- **Pictures carry state.** The Oath seal shows the Oath's state as a living object, Żaromir's face carries tone, pictograms carry rules. Labels stay (clarity rule 4).
- **The need comes from the Oath.** The player's one care action is the real one: bring proof by the deadline. No second, invented clock.
- **No shame.** The seal is never sad, nothing withers or dies, neutral states are never red.
- **Honest server state.** Every state, step and result comes from the server. Presentation may use the server-corrected clock against the stored D and S, as the Oath path already does for its last-hour and cutoff situations (`apps/mobile/src/oaths/oathPath.ts`).

Evidence behind the goals:

- People read about 20 % of the words on a page. Source: [NN/g, How little do users read](https://www.nngroup.com/articles/how-little-do-users-read/) (search summary).
- Up-front tutorials did not improve task success and made tasks feel harder. Source: [NN/g, mobile tutorials](https://www.nngroup.com/articles/mobile-tutorials/) (opened). Contextual help beats push tutorials. Source: [NN/g, onboarding tutorials vs contextual help](https://www.nngroup.com/articles/onboarding-tutorials/) (opened).
- Icons need a visible label. Source: [NN/g, icon usability](https://www.nngroup.com/articles/icon-usability/) (opened).
- Appointment play is a dark pattern when the game owns the clock and lets things wither. Source: [Zagal, Björk and Lewis, Dark Patterns in the Design of Games, FDG 2013](http://www.fdg2013.org/program/papers/paper06_zagal_etal.pdf) (opened). Death in a virtual pet produced grief. Source: [Wellcome Collection, digital pets](https://wellcomecollection.org/stories/digital-pets) (opened). Finch removed pet death because it was too anxiety-inducing. Source: [Finch FAQ](https://befinch.notion.site/Finch-FAQ-474652d0123d4883ac7a0cd6c8f5aa70) (search summary).
- A shown broken streak lowers later activity. Source: [Silverman and Barasch 2023](https://www.insead.edu/faculty-research/publications/journal-articles/or-track-how-broken-streaks-affect-consumer) (cited in [clarity](clarity.md)).

## Delegated decisions

Each is a **delegated decision 2026-10-02, owner review pending**.

- **D-E1 Declaration.** The rules review shows the stored declaration as the label of a press-and-hold seal control. The label is fully readable before acceptance. Explicit acceptance stays: a completed hold is the acceptance. VoiceOver and Switch Control get a double-tap alternative. Reduce Motion gets a still fallback. Corrected 2026-10-02 after review: the hold label is the promise, the declaration is the proof-time confirmation. The past-tense declaration was accepted before the workout, which is not honest. It stays readable before acceptance in "Pełne zasady" under "Potwierdzenie przy dowodzie" / "Confirmation with your proof".
- **D-E2 Oracle.** Światowid, a four-faced idol in the Forge, "reads" the proof and reports. The Forge seals the result. AI cannot grant rewards, unclear is never failure and no duration is promised. Until MVP-08 and MVP-09 deliver verdicts only the hand-over and the waiting state exist.
- **D-E3 The seal is never sad.** It is only anticipatory. No decay, withering, death, cracks or red for neutral states. A paused character shows the pause mark. States come only from the server.

Choices made while writing this spec, each also a **delegated decision 2026-10-02, owner review pending**:

- **D-E4 Word counting rules** in E1 (what counts, exemptions, ratchet).
- **D-E5 Hold completion** on release after a full hold, see E3.
- **D-E6 Reward and consequence stay visible** on the review as two small pictograms, keeping owner decision Q2, see E3.
- **D-E7 Skill gate in the room** replaces the four-step first-visit guide, see E2.
- **D-E8 Tutorial chapters** become one bark each, the other existing lines move behind "Więcej" / "More", see E2.
- **D-E9 Proof teaching at the moment of use** replaces the planned proof chapter of the tutorial, see E2.
- **D-E10 Wordless Żaromir** in review and assessment, with the listening face, see E5.
- **D-E11 The proof declaration** uses the same hold-to-seal control as the review, see E6.
- **D-E12 No proof image in the hand-over.** The scene shows a generic framed plate, see E6.
- **D-E13 Close-up scene, not a room edit.** Światowid stands in a close-up, not in the room artwork, until the final room art is chosen, see E6.

## Invariants for every change

Each change keeps these. A task that cannot keep one stops and reports.

1. **Clarity rules 1 to 10** in [clarity](clarity.md), with the dated exceptions below. One filled action per screen. Facts never live in a bubble (clarity decision 14).
2. **Server-owned state.** Backend owns state, deadlines, XP and entitlements ([MVP](mvp.md) "Domain guardrails"). Animations play only after the server confirms, as the seal stamping already does ([Oath screens](oath-screens.md) section 3). A device countdown never changes a state.
3. **No shame.** Żaromir never reproaches. No urging while paused, in review or after an illness disclosure (clarity rule 8). Nothing accumulated is taken away. Neutral states are never red (clarity rule 5).
4. **Accessibility.** Controls at least 44 pt. Every pictogram has a visible label of one to three words and an `accessibilityLabel` (clarity rule 4). Decorative art is hidden from VoiceOver. Shape, not only colour, separates states.
5. **Reduce Motion and simple layout** keep a still equivalent of every animation and every scene (clarity rule 10).
6. **PL and EN native copy.** Polish first, natural English, no em dash, no semicolon, English says proof ([glossary](glossary.md)). Copy changes run `python3 .agents/commands/review_copy.py`.
7. **Every rule reachable before acceptance.** Stored rule text is never paraphrased away and stays one touch away ([Oath screens](oath-screens.md) "Boundaries").
8. **Proof privacy.** No proof image in logs, analytics or any shared view ([security rules](../../.agents/rules/security.md)).

## E1. Word budget (opportunity 4)

### Player-facing behaviour

Every screen state shows at most **25 counted words** in each language at standard text. A Żaromir bark has at most 12 Polish words until E5 tightens it. Nothing structural changes in E1 itself, apart from cuts on screens that no later step redesigns.

### What it replaces

The owner's "too much text" becomes a number that jest checks. It adds to the 12-word "what next" cap of clarity decision 3, which stays.

### Counting rules (D-E4)

**Local decision**, informed by the research estimate that 25 words take about 6 seconds at the average 238 words per minute ([Brysbaert 2019](https://www.researchgate.net/publication/335174808_How_many_words_do_we_read_per_minute_A_review_and_meta-analysis_of_reading_rate), search summary).

- **What is measured.** The whole rendered screen state, scroll content included, because jest has no layout. Folded disclosures are closed. Their children are not rendered, so they cost nothing. Motion is off, so the dialogue panel shows its whole line and its art gate is resolved.
- **Viewport.** 402 × 874 pt, font scale 1, the iPhone 18 Pro at standard text.
- **A word** is a whitespace-separated token in drawn text that contains at least one Latin letter, Polish letters included. Times, dates, numbers and symbols such as "02:30", "29", "·", "✓" and the "ϟ" pictogram do not count. "2 d 5 h" counts as two words. The app draws only Polish and English, so another script is a symbol (local clarification, MVP-22-E1.R, 2026-10-02).
- **Counted:** every drawn text, including buttons, links, the way back, headings, card lines and Żaromir's bubble.
- **Not counted:** accessibility labels and hints, which are not drawn.
- **Exempt, marked in code:**
  - `icon`: a pictogram label of one to three words drawn beside its pictogram (clarity rule 4). The helper fails a test if an `icon` text has more than three words.
  - A one-word field caption drawn beside its calendar or clock pictogram is an `icon` label. The Oath form's date and time rows use it (local clarification, MVP-22-E1.5, 2026-10-02).
  - `error`: a required error or refusal sentence (clarity decision 3).
  - `declaration`: the stored promise as the label of the hold control (D-E1, corrected 2026-10-02) or the stored declaration of the proof confirmation.
  - `rules`: stored rule text when a test opens the fold on purpose.
  - An exemption covers its own text only. A counted text nested inside an exempt one still counts (local clarification, MVP-22-E1.R, 2026-10-02).
- **Lists.** Today and History are measured with one Oath. Each further row may add at most 8 counted words.
- **Both languages** are measured. Each must meet the budget.

### Measuring in jest

- A helper `visibleWords(root)` (new, `apps/mobile/src/ui/wordBudget.ts`) walks the rendered host tree, collects the strings of host `Text` nodes outside exempt subtrees and returns the count with the counted words, so a failing test names them.
- The exemption is a prop of the app's `ui/Text.tsx`, `budget?: 'icon' | 'error' | 'declaration' | 'rules'`. It must not add a view, change layout or change accessibility. The exact host mapping is chosen in task E1.1.
- **Ratchet.** A fixture `apps/mobile/src/ui/wordBudget.baseline.json` (new) records the measured count for each named screen state and language. The test fails when a count rises above its recorded ceiling. When a step lowers a count, the ceiling is lowered in the same change. A ceiling above 25 names the step that must bring it to 25. At the end of E6 every ceiling is 25 or less.
- `review_copy.py` stays the copy tone check. It does not count screen words.

### Screen states and the step that brings each to 25

The measured ceilings live in `apps/mobile/src/ui/wordBudget.baseline.json` since MVP-22-E1.2, each with the step that brings it to 25. This table keeps the original plan. A step may reach 25 earlier.

| Screen state | Brought to 25 by |
| --- | --- |
| Main menu, Settings, pause review, onboarding steps, sign-in, character creation and switch, Oath form, History list | E1 |
| Confirmation after the seal | E1, or E5 if Żaromir's greeting keeps it above 25 |
| Forge room panels, first entry, tutorial in the room and the simple tutorial screen | E2 |
| Rules review | E3 |
| Today list and seal wall | E4 |
| Oath detail in every state | E5 |
| Proof screen, its pending states and the hand-over | E6 |

### Invariants to keep

Cuts move text behind a link and never delete it (clarity rule 2). Required errors stay. Labels on pictograms stay.

### Acceptance

- Jest: `visibleWords` unit tests (counting rule, exemptions, the three-word limit for `icon`, closed folds cost nothing).
- Jest: one ratchet test per named screen state in PL and EN, reading the baseline file.
- Jest: every E1-owned screen state is at 25 or less in both languages.
- Native, iPhone 18 Pro, standard text, PL and EN: each screen cut in E1 shows no lost fact and no empty band where text was.

### Art needs

None. Screens that lack a picture of their state are listed in the E1 report as art candidates.

### Fallback

Not applicable.

## E2. Teach at the moment of use (opportunity 6)

### Status

Implemented locally on 2026-10-02 in MVP-22-E2.1 to E2.4, with a follow-up after the E2.2 native check. Owner review of D-E7, D-E8 and D-E9 is pending. Native checks on the iPhone 18 Pro are pending for the tutorial barks, the first proof bark and the stronger shade. The first entry gate was checked natively before the follow-up.

- `apps/mobile/src/forge/placeLit.ts` decides which place glows. Unknown counts light every place.
- The first entry is one bark beside the lit hearth. An unlit place walks the player there, plays its bark and offers no action. Its VoiceOver label ends with "jeszcze nieaktywne" / "not active yet".
- Unlit places carry a DUMMY code-drawn shade over the whole station. One translucent dark ellipse per station darkens and greys it with no blend mode and fades to nothing before its box edge. While another place is unlit the hearth glows brighter and breathes with the room's glow. Reduce Motion keeps that glow still. The shade boxes, colour and stops are `unlitShades`, `UNLIT_SHADE_COLOR` and `UNLIT_SHADE_STOPS` in `apps/mobile/src/forge/sceneLayout.ts`.
- A paused character gets no urging in the room (invariant 3). Unlit places keep their shade, but the hearth does not breathe or glow brighter and the places keep their plain VoiceOver names. The first entry bark and an unlit place's bark become the pause hint "Twoja pauza trwa, a powrót czeka w Ustawieniach." / "Your pause is on. You can resume in Settings." (review fix MVP-22-E2r3, 2026-10-02).
- Each tutorial chapter in the room opens on one bark with "Więcej" / "More" and "Inne miejsce" / "Another place", or "Zakończ" / "Finish" on the fourth place. A bark alone counts the chapter as heard. The simple tutorial screen is unchanged.
- The first proof screen per account on this device shows Żaromir's teaching bark. Its flag uses the device guide storage under the name `proof-guide`. Once a proof type is chosen, his rotating line replaces the bark.

Local decisions, 2026-10-02, owner review pending:

- Chapter barks keep to 8 Polish words, the bark cap for slice E, which is stricter than the 12 words below.
- "Więcej" plays the player's question first, then Żaromir's accepted lines with the counter. So the tutorial player lines of the [Forge scene](forge-scene.md) stay in use.
- The proof flag is kept per account, as "Acceptance" says. The behaviour line below names a character. The account wins because the teaching is for the player, not for one character.
- The proof bark replaces only the rotating proof line. Between D and S the conditional cutoff line stays. While a proof is sent, while an upload waits and on an Oath that is no longer active Żaromir behaves as before. The flag is written only once the bark is on screen.
- On the seal cut that covers a figure behind the drums, the shade only darkens. The blend cannot reach through the cut's own layer. Native check pending.

| Key | Polish | English |
| --- | --- | --- |
| `room.tutorial.hearth.bark` | Przy ogniu wykuwasz nową Przysięgę. | At the fire you forge a new Oath. |
| `room.tutorial.seals.bark` | Pieczęcie to Twoje bieżące Przysięgi. | The seals are your current Oaths. |
| `room.tutorial.chronicle.bark` | Kronika pamięta każdą zakończoną Przysięgę. | The chronicle remembers every finished Oath. |
| `room.tutorial.door.bark` | Drzwi prowadzą do menu, postaci i pauzy. | The door leads to the menu, characters and pause. |
| `room.tutorial.more` | Więcej | More |
| `zaromir.proofFirst.0` | Najpierw wybierz rodzaj dowodu. | First, choose the proof type. |

Measured word budgets in `apps/mobile/src/ui/wordBudget.baseline.json`: `room.tutorialChapter` 12 Polish and 15 English words, `room.tutorialMore` 13 and 16, `proof.firstVisit` 67 and 80. The proof form stays an E6 target.

### Player-facing behaviour

- **First room entry, skill gate (D-E7).** Only the hearth glows. Żaromir stands beside it and says one bark, such as PL "Zacznij tutaj, od ognia." EN "Start here, at the fire." The other places are drawn unlit.
- **Places light up when they have something.** The seals light when the character has at least one current Oath. The chronicle lights when it has at least one entry. Counts come from the existing server totals (`useForgeProgress`).
- **Touching an unlit place** walks the player there and plays one bark that says when it lights, such as PL "Tu zapłoną pieczęcie Twoich Przysiąg." EN "Your Oaths' seals will glow here." No station action is offered.
- **The door and the "Wróć do menu" plate always work** ([Forge scene](forge-scene.md), MVP-22-B3).
- **Unknown counts fail open.** If the counts cannot be read, every place is lit, so the player is never locked out.
- **Tutorial chapters (D-E8).** In the room each chapter plays one bark of at most 12 words while Żaromir gestures at the place. A "Więcej" / "More" control in the panel plays the chapter's other existing lines. The simple tutorial screen keeps its folded chapters.
- **First proof (D-E9).** The first time a character opens the proof screen on this device, Żaromir's line is a one-time teaching bark for the first step. Later visits use the normal rotating line. The flag uses the existing device guide storage pattern (`apps/mobile/src/forge/guideStorage.ts`).
- **First review.** Taught at the moment of use by E3.

### What it replaces

The four-step first-visit guide, most of the tutorial chapter text on first play, and the planned tutorial chapter about proof submission.

### Invariants to keep

- The tutorial teaches only behaviour that works today ([tutorial](tutorial.md), 2026-09-27).
- The Tutorial tile stays a replayable reference in both layouts. Source: [Apple, Onboarding for Games](https://developer.apple.com/app-store/onboarding-for-games/) (opened): teach one step at a time, keep "How to Play" replayable.
- Unlit is not locked. Unlit places stay touchable and named for VoiceOver, with "jeszcze nieaktywne" / "not active yet" in the accessibility label.
- Reduce Motion: no glow pulse, lit places use a still glow, unlit ones none.

### Acceptance

- Jest: a pure `placeLit(place, counts)` table, including unknown counts lighting every place and the door always lit.
- Jest: `ForgeRoom` first entry lights only the hearth, an unlit touch plays its bark without an action, the door and the plate leave the room.
- Jest: a chapter plays one bark, "Więcej" plays the existing lines in order, the simple screen is unchanged.
- Jest: the proof screen shows the teaching bark once per account and device, then the rotating line.
- Jest: E2 screen states at 25 or less.
- Native, iPhone 18 Pro, PL and EN: a fresh character sees only the hearth lit, after the first Oath the seals light, the tutorial "Więcej" path, the first proof bark.

### Art needs

- Per place an unlit and a lit state. The current place glows exist. Unlit is code-drawn dimming at first.
- Optional, after owner review: four Żaromir pointing gestures, one per place, as 4-frame sheets matching the existing pose sheets in [Forge motion assets](../art/forge-motion-assets.md).

### Fallback

Unlit places use a code-drawn dark overlay over the room cut, marked DUMMY in the registry comment. Gestures reuse the existing talk gestures.

## E3. Rules review as three pictograms and press-to-seal (opportunity 2)

### Player-facing behaviour

From the top:

1. The promise, unchanged in content. Since the D-E1 correction of 2026-10-02 it is drawn once, as the hold label in item 4, not as a separate line.
2. **Three large pictograms**, about 96 pt, each with a one-to-three word label and one value:
   - Hourglass, "Termin" / "Deadline", the hour of D with the short day.
   - Candle, "Ostatni moment" / "Last chance", "+15 min".
   - Anvil with a lock, "Zasady stałe" / "Rules fixed", the value "bez zmian" / "no changes". The value is words, so it counts as a pictogram label (native check and owner instruction, 2026-10-02, MVP-22-E3r). It replaced "no value", which left the card half empty.
3. **Two small pictograms (D-E6)**, about 48 pt, "Nagroda" / "Reward" and "Jeśli nie zdążysz" / "If you miss it", each with one short snapshot value. This keeps owner decision Q2: reward and consequence are seen without opening the full rules. The consequence value is the snapshot's missed XP with "bez straty" / "no loss", for example "0 XP, bez straty", and counts as a pictogram label. It replaced the fixed "XP zostaje" / "XP kept" (review, 2026-10-02).
4. **The hold-to-seal control (D-E1).** A wax seal under the player's hand. Its label is the stored promise, fully drawn (corrected 2026-10-02 after review, it was the declaration). A short hint that names the action, "Przytrzymaj, by złożyć Przysięgę" / "Hold to commit to the Oath" (proposal wording under Q5, clarity rules 4 and 10).
5. One consent line, reworded because the button "Złóż Przysięgę" no longer exists, for example PL "Przytrzymując pieczęć, akceptuję zasady z kart i pełne zasady." EN "By holding the seal, I accept the rules shown here and the full rules." Final wording is a copy task under Q5.
6. "Pełne zasady" / "Full rules" opens the other four cards (start, proof, review, pause) and the complete stored rules, unchanged.
7. "Zmień" / "Change" returns to the form, as a text-style action. VoiceOver hears "Zmień wybory" / "Change choices" (review, 2026-10-02).

**Hold rules (D-E5).**

- Holding fills a ring around the seal over 1.0 s (local decision).
- The acceptance fires on release after the ring is full. Releasing early or sliding off cancels and the ring empties. Completion on the up-event with a way to abort meets [WCAG 2.1, 2.5.2 Pointer Cancellation](https://www.w3.org/WAI/WCAG21/Understanding/pointer-cancellation.html) (opened for this spec).
- A full hold calls the existing idempotent `controller.confirm()`. While the request runs the control is busy and ignores touches. The stamping animation still waits for the server's confirmation.
- A long press is not a path-based gesture, so [WCAG 2.1, 2.5.1](https://www.w3.org/WAI/WCAG21/Understanding/pointer-gestures.html) does not require an alternative (not opened for this spec). The alternatives below are a local decision.
- **VoiceOver and Switch Control.** The control is always an accessible button with the standard `activate` action. Its label is the promise followed by "Złóż Przysięgę" / "Commit to the Oath" (corrected 2026-10-02, it was the declaration). React Native engages `activate` on the VoiceOver double tap. Source: [React Native accessibility](https://reactnative.dev/docs/accessibility) (opened for this spec). Switch Control's select is expected to send the same activation, which the native check confirms. When `AccessibilityInfo.isScreenReaderEnabled()` reports a screen reader, the drawn hint reads "Stuknij dwukrotnie, by złożyć Przysięgę" / "Double-tap to commit to the Oath".
- **Reduce Motion.** The ring does not animate. After 1.0 s of holding the seal shows its full state in one change, and the release accepts.

**Żaromir on the first review.** His four bubbles become one bark per pictogram, at most 8 words, while that pictogram plays its gesture: the sand runs, the candle flickers, the lock clicks. The dialogue panel and the "seen" flag stay as accepted in decision Q4. Reduce Motion highlights the pictogram without motion. While the panel is open the review ends above the panel and the rising bust, so neither covers a card, the seal or its hint. A seal block that crosses that edge moves the page down, but never past the named card (native check, 2026-10-02, MVP-22-E3r). When that cap would leave the edge across the seal's label or hint, the edge moves up into the gap under the seal's ring, and a soft fade into the scene floor sits on it (native check, 2026-10-02, MVP-22-E3r2). Word values such as "bez zmian" and "0 XP, bez straty" take a smaller style than the figures and break only after a comma. Review, 2026-10-02: the second bark counts the snapshot's grace minutes with plural forms instead of a fixed quarter hour. VoiceOver hears the named pictogram's spoken label before each bark. A hold while he speaks closes his explanation as seen.

### What it replaces

The eight-card grid, the declaration block above the cards, Żaromir's four-line guide text and the "Złóż Przysięgę" button. The cards for start, proof, review and pause move into the fold.

### Invariants to keep

- Every rule stays reachable before acceptance. Stored rule text is unchanged.
- Explicit acceptance stays. Nothing is accepted on the down-event or by an accidental touch.
- One filled action: the hold control is the only filled control. "Zmień" is text style.
- Values come from the snapshot, never from device settings.

### Acceptance

- Jest: `HoldSeal` releases early and nothing is called, a full hold and release calls `onSeal` once, a second hold while busy does nothing, the `activate` action calls `onSeal` once, a screen reader changes the drawn hint, Reduce Motion renders no animated ring.
- Jest: the review shows three large and two small pictograms with snapshot values, the promise drawn as the hold label, the four other cards, the declaration and the stored rules only after "Pełne zasady".
- Jest: an accepted Oath only after the server confirms, a lost response still replays once.
- Jest: the review is at 25 counted words or less in PL and EN with the hold label exempt.
- Native, iPhone 18 Pro, PL and EN: hold, early release, full hold, the first-review barks, Reduce Motion on.

### Art needs

All through the Codex route in the [art pipeline](../art/pipeline.md), current and cinematic style.

| Asset | Sheet | Cells | Notes |
| --- | --- | --- | --- |
| Large rule pictograms: hourglass, candle, locked anvil | `rule-pictograms-v01.png` | 3 cells of 288 × 288 px (96 pt at 3x), RGBA | Simpler than the 40 pt rule icons, readable at 96 pt on the dark review surface |
| Small pictograms: reward, consequence | `rule-pictograms-small-v01.png` | 2 cells of 144 × 144 px (48 pt at 3x), RGBA | Replace the DUMMY reward and consequence icons of MVP-21 |
| Pictogram gestures: sand run, candle flicker, lock click | `rule-pictogram-gestures-v01.png` | 3 rows of 6 frames, 288 × 288 px cells | Registered to the stills, light and small motion only |
| Hold seal: idle, pressed, full, sealed | `hold-seal-v01.png` | 4 cells of 360 × 360 px (120 pt at 3x), RGBA | The ring is drawn in code over the stills |

### Fallback

The existing rule icon cells scaled up (`oaths.ruleIcons`), marked DUMMY in the registry comment and the manifest. The hold seal falls back to the existing `seal-stamp` frames with a code-drawn ring.

## E4. The Oath seal as the creature (opportunity 1)

### Player-facing behaviour

The seal on the seal wall, on Today rows, on the detail and on the confirmation becomes a living object with care states. It never looks sad (D-E3).

| Server state, device record and server-corrected clock | Care state | Look |
| --- | --- | --- |
| `scheduled` | Dormant | Cold wax, no flame |
| `active`, more than 1 hour before D | Kindled | Small flame |
| `active`, within the last hour before D | Warming | Larger flame, ember ring |
| `active`, after D and up to S | Ready to receive | Open ring of light, flame upright |
| `active`, after S while the server has not settled | Dormant | Cold wax, as the card says the proof window closed |
| `proof_pending`, `needs_more_evidence`, `review_pending` | Held breath | Seal wrapped in still smoke, small hourglass mark |
| `fulfilled` | Sealed | Stamped wax with a steady flame and laurel |
| `missed`, `unresolved`, `withdrawn` | Quiet stone | Whole stone disc with a carved rune, no flame, no crack |

- **Interrupted upload.** The care state stays and the amber "Nie dotarł" / "Not received" badge stays on the opposite corner (clarity decision 9).
- **Paused character.** Pause withdraws scheduled and active Oaths, so only held-breath seals remain ([first loop](first-loop.md#pause-decision-table)). They show the pause mark of [clarity](clarity.md) "Pause mark" and stop their loop.
- **Unknown pause.** No loop and no pause mark on the seal. The list line carries the unknown mark as today.
- Touching a seal opens the detail, as today. The one action stays on the detail's card.
- The countdown chip stays as a small label under the seal.

The warming and ready looks use the server-corrected clock against the stored D and S, like the existing `activeSoon` and `cutoff` situations. They never change the state and never claim a result.

### What it replaces

The state seal picture as the main signal on the seal wall, the Today row emblem and the detail emblem. The short state label, the step track and the countdown chip stay. Shrinking the step track was suggested by the research and was not decided by the owner, so it is not part of this spec.

### Invariants to keep

- States come only from the server (D-E3, clarity rule 6). The device never moves a seal to sealed or quiet.
- Each care state differs by shape, not only by glow colour. Neutral looks are never red (clarity rule 5).
- No decay, no withering, no death, no crack, no loss of anything earned ([MVP](mvp.md) "Do not erase all accumulated progression").
- The seal picture is decorative for VoiceOver. The state label and the seal button label carry the meaning.
- Reduce Motion shows stills only.

### Acceptance

- Jest: a pure `sealCare(oath, device, paused, now)` table over every row above, including 59 minutes before D, D plus 1 minute, S plus 1 minute, interrupted, paused true and unknown.
- Jest: `LivingSeal` renders the still for each care state, the pause mark when paused, the interrupted badge, no loop under Reduce Motion.
- Jest: the seal wall, Today rows, detail and confirmation use it, and the Today list with one Oath is at 25 counted words or less.
- Native, iPhone 18 Pro, PL and EN: each care state through the demo controls, Reduce Motion on.

### Art needs

| Asset | Sheet | Cells | Notes |
| --- | --- | --- | --- |
| Care stills: dormant, kindled, warming, ready, held breath, sealed, quiet stone | `seal-care-v01.png` | 7 cells of 432 × 432 px (144 pt at 3x), RGBA | Shown at 34 to 144 pt. Shapes must differ at 34 pt |
| Loops: kindled, warming, ready, held breath | `seal-care-loops-v01.png` | 4 rows of 8 frames, 432 × 432 px cells | Light, flame and smoke only, registered to the stills |

The seal is a new identity, so the owner sees the care stills before they are hooked up (local choice, following pipeline steps 2 and 3: select an identity and test new states against it before batch production).

### Fallback

The existing `StateSeal` with a code-drawn glow ring for kindled, warming and ready, marked DUMMY in the registry comment and the manifest.

## E5. Żaromir's moods (opportunity 5)

### Player-facing behaviour

Żaromir's face carries the tone, so his words drop.

| Mood | Situations |
| --- | --- |
| Calm | scheduled, active, withdrawn, the first entry and normal room hints |
| Attentive | the last hour before D, between D and S, an interrupted upload before S |
| Pleased | fulfilled, the confirmation after the seal |
| Listening | proof pending, review, missed, unresolved |
| Resting | a paused character, in the room only, as his idle pose |

- **Bark length.** At most 8 Polish words and 10 English words.
- **Wordless situations (D-E10).** In review and while the proof is assessed he shows the listening face with no bubble. This supersedes clarity decision 5 and "Żaromir's line" ("in review only one neutral sentence"), dated in [clarity](clarity.md).
- **Still silent** while paused, while the pause flag is unknown for pending states, for `needs_more_evidence` until MVP-08 gives it a next step, and while a proof is being sent (clarity decision 5). Resting is his idle pose in the room while paused. A touch on him still shows the paused hint and the pause mark, because they state a fact ([Forge scene](forge-scene.md) "Hint and counters"), now with the resting bust.
- After a miss: the listening face and one calm next step, never sadness (clarity decision 7).
- The dialogue panel bust follows the mood.

### What it replaces

Part of the line pools of clarity decision 8 and the reliance on text for warmth. Pool sizes may shrink.

### Invariants to keep

- No sad, disappointed or angry face anywhere. Source for the line: [Gentler Streak, Apple Developer, 2024](https://developer.apple.com/news/?id=3m0ht22s) (opened). The small breakfast study where a sad pet helped is weak support and is not followed. Source: [Cornell Chronicle, 2011](https://news.cornell.edu/stories/2011/12/fake-fido-can-motivate-your-child-eat-breakfast) (press release opened), with the misconduct caveat in the research.
- Urging only in the three windows of clarity decision 6.
- Facts never live in the bubble (clarity decision 14).
- The bust is decorative. VoiceOver reads the line with the speaker name, or nothing when there is no line.

### Acceptance

- Jest: a pure `zaromirMood(situation)` table, every situation mapped, no situation maps to a sad face because none exists.
- Jest: `ZaromirLine` shows the mood bust, no bubble in review and assessment, nothing while paused.
- Jest: a catalog test caps every `zaromir.*` line at 8 Polish and 10 English words.
- Jest: every detail state is at 25 counted words or less.
- Native, iPhone 18 Pro, PL and EN: each mood on the detail and in the room panel.

### Art needs

| Asset | Sheet | Cells | Notes |
| --- | --- | --- | --- |
| Bust expressions: calm, attentive, pleased, listening, resting | `zharomir-moods-v01.png` | 5 cells of 399 × 384 px, RGBA, the size of `zharomir-bust-v01` | The same head, beard, cheek seam and lantern as the [companion brief](../art/companion.md). No sad face |

The owner sees the five expressions before hookup (local choice, as for E4). Matching room poses are a later art task after the busts are accepted.

### Fallback

The current bust for every mood, marked DUMMY in the registry comment. The wordless rule still applies.

## E6. Proof hand-over and Światowid's waiting state (opportunity 3)

### Player-facing behaviour

**The hand-over** plays once per `submissionId`, only after the server's receipt arrives (the proof screen's `onDone` with the server's Oath). It never plays on the tap that sends.

1. A close-up of the anvil before the idol (D-E13).
2. A generic framed plate is laid on the anvil (D-E12). The proof image is not shown.
3. Żaromir takes the plate and turns to the idol.
4. Światowid's first face lights: the server received the proof.
5. The receipt stamp lands on the Oath seal, which becomes held breath (E4).
6. One line: PL "Dowód przyjęty." EN "Proof received." with the receipt time in the Oath's zone.

It lasts at most 4 seconds (local decision, under the 10-second attention limit of [NN/g, response time limits](https://www.nngroup.com/articles/response-times-3-important-limits/), search summary). A tap skips to the last frame. It ends on the detail. Reduce Motion shows the last frame with the line. VoiceOver announces the line once.

**The waiting state** on the detail of `proof_pending`, `needs_more_evidence` and `review_pending`:

- A small still of Światowid with one face lit for the receipt and three faces dormant and looking. Nothing else lights, because no further step is reported by the server today.
- No percentage, no time, no fake step. Showing real work raises perceived value. Faked progress is out. Source: [Buell and Norton, The Labor Illusion, 2011](https://www.hbs.edu/faculty/Pages/item.aspx?num=40158) (first two pages opened).
- The card line stays as today, without a time (clarity rule 6).

**The reveal** on return is not built. It needs MVP-08 and MVP-09. When they exist, a reveal is specified as its own change: the idol turns its face and reports, the Forge stamps the result.

**The proof form (D-E11).** The declaration checkbox becomes the hold-to-seal control of E3 with the stored completion declaration as its label and the hint "Przytrzymaj, by wysłać dowód" / "Hold to submit proof". The privacy line and the AI line shrink to the budget. The long texts stay behind their links.

### Lore

Światowid is modelled on Svetovit, the four-headed god of Arkona described by Saxo Grammaticus. Sources: [Svetovit, Wikipedia](https://en.wikipedia.org/wiki/Svetovit), [Sventovit, Encyclopedia.com](https://www.encyclopedia.com/environment/encyclopedias-almanacs-transcripts-and-maps/sventovit) (both search summary). His role as the Forge's reader of proof is original lore and must be labelled so ([glossary](glossary.md#language-and-naming-rules)). The glossary says the Referee is "an evidence-assessment role, not a separate required character". Światowid is the Referee's picture in the Forge, not a new mechanic.

Verification limits: the research saw only summaries. The Polish form is open between "Światowid", the popular name also used for the Zbruch idol, and "Świętowit", closer to the historical sources. The English form is "Svetovit". The E6 copy task checks a primary or scholarly source and records the term in the glossary.

### What it replaces

The "app-like" pending card right after submission, and the checkbox on the proof form.

### Invariants to keep

- AI assesses, the Forge seals. The idol only looks and reports. XP and results come from the backend ([MVP](mvp.md), [AI verification](../engineering/ai-verification.md)).
- Unclear is never failure. No angry, turned-away or red face for `needs_more_evidence`, `review_pending` or `unresolved`.
- No promised duration (clarity rule 6). The owner's polling decision for verdicts in [Oath screens](oath-screens.md) section 4 is unchanged.
- The proof image is never shown in the scene, never logged and never shared.
- The interrupted upload, resend and closed-window flows are unchanged. No hand-over without a receipt.
- A lost device flag may replay the hand-over once. That is the safe loss.

### Acceptance

- Jest: a pure `handOverDue(oath, seen)` plays only for a server Oath with a receipt and an unseen `submissionId`, never for a device copy or a refusal.
- Jest: `HandOverScene` skips on tap, shows the last frame under Reduce Motion, announces once, ends on the detail.
- Jest: the waiting still lights exactly one face for each of the three pending states and none before a receipt.
- Jest: the proof form's hold control calls submit only after a full hold, the screen reader path uses `activate`, and every proof screen state is at 25 counted words or less.
- Native, iPhone 18 Pro, PL and EN: send a proof in the demo, watch the hand-over, cold relaunch and see it does not replay, the lost-response demo control replays the receipt without a second hand-over.

### Art needs

| Asset | Sheet | Cells | Notes |
| --- | --- | --- | --- |
| Światowid idol: looking, then faces 1 to 4 lit | `swiatowid-v01.png` | 5 cells of 480 × 720 px (160 × 240 pt at 3x), RGBA | Four faces, horn in the right hand, carved wood and bronze of the Forge. Neutral faces only |
| Hand-over close-up: anvil before the idol | `station-handover-v01.jpg` | 1 image, the size of the existing station close-ups | Same light and palette as the station close-ups |
| Generic framed plate | `proof-plate-v01.png` | 1 cell of 360 × 270 px, RGBA | No picture on it, no text |
| Żaromir takes and turns | `zharomir-handover-v01.png` | 6 frames of the existing Żaromir pose cell size | Matches [Forge motion assets](../art/forge-motion-assets.md) |

Światowid is a new identity, so the owner sees the idol before hookup (local choice, as for E4).

### Fallback

The hearth station close-up with a code-drawn plate and four code-drawn face discs, marked DUMMY in the registry comment and the manifest. The receipt stamp reuses `seal-stamp`.

## Dependencies

- E1 first. Its ratchet measures every later step.
- E3's hold control is reused by E6. E4's held-breath seal and E5's moods are used by E6.
- Art runs in parallel with code. Code ships with the DUMMY fallback until the art is selected.
- **Opportunity 7, character growth with XP**, needs granted XP from MVP-09 and is out of this spec.
- **The reveal** needs MVP-08 verdicts and MVP-09 results.
- **Notifications** stay in MVP-06.

## Conflicts with accepted decisions

Each is superseded only by a delegated decision and needs owner review.

| Accepted decision | Changed by | Note |
| --- | --- | --- |
| [Oath screens](oath-screens.md) Q1: promise and declaration as text above the cards | D-E1, E3 | The promise becomes the hold label, still fully drawn. The declaration moves into the fold as the proof-time confirmation (corrected 2026-10-02) |
| [Oath screens](oath-screens.md) Q5: card titles, Żaromir's four guide lines and the consent line accepted as written | E3 | The consent line names a button that no longer exists. New guide barks |
| [Oath screens](oath-screens.md) Q2: reward and consequence cards visible | kept by D-E6 | No conflict if the owner accepts the small pictograms |
| [Clarity](clarity.md) rule 7 and decision 5: two sentences, one neutral sentence in review | D-E10, E5 | Shorter barks, wordless review and assessment |
| [Tutorial](tutorial.md) 2026-09-27: a few lines per chapter, the four-step first-visit guide stays, proof gets a chapter when it exists | D-E7, D-E8, D-E9 | Proof submission exists since MVP-07, its teaching moves to the moment of use |
| [Forge scene](forge-scene.md) D3: in the first-visit guide only Żaromir walks to each step's place | D-E7 | The four-step guide ends, the first entry lights only the hearth |
| [Glossary](glossary.md): Referee is not a separate required character | D-E2 | Światowid is the Referee's picture, the term needs a glossary row |
