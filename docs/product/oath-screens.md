# Oath screens: friendlier rules, sealing and countdowns

Status: accepted by the owner on 2026-09-28 for the epic MVP-21 (decisions Q1 to Q5 below). Implemented in the mobile app in MVP-21 on 2026-09-30 (tasks T01 to T13), with no API change. Native checks ran on the iPhone 18 Pro in PL and EN, see [testing](../engineering/testing.md#oath-screens-acceptance-mvp-21-2026-09-30). Limits: the reward and consequence icons are DUMMY, and the card value lines for proof, review, reward, consequence and pause are drafts awaiting owner review. iPhone SE 3, VoiceOver, Reduce Motion for the stepped hourglass, a Release build and physical devices were not observed. Proof verdict updates in section 4 remain not implemented. Owner acceptance is pending.

## Purpose

After the MVP-20 demo the owner found the Oath screens too wordy and flat (owner review, 2026-09-28, items 1, 2, 3, 4 and 6):

1. The calendar does not mark today and lets the player pick a past date.
2. "Zobacz zasady" / "See the rules" opens a wall of text. It should be friendlier, built on artwork and icons, and Żaromir may explain it the first time.
3. After "Złóż Przysięgę" / "Commit to the Oath" another wall of text appears and nothing shows that something happened. It needs a seal stamping animation and a countdown to the deadline.
4. "Twoje Przysięgi" / "Your Oaths" should be friendlier, each Oath with a countdown to its close.
5. History has too much text. Simplify it and encourage visually in every text view.

The goal is the same information with less reading: pictures and short labels first, the full text one touch away.

## Boundaries

These rules come from accepted documents and do not change:

- Before making the Oath the player can see all its rules. Only explicit acceptance creates it ([tutorial](tutorial.md), `room.tutorial.hearth.3`, [MVP](mvp.md) "Player sees the rule, consequence and recovery option before confirming").
- The preview shows activity, activation, D, S = D + 15 minutes, timezone and offset, both evidence alternatives, the declaration, evidence limits, the reward and consequence policy and pause or withdrawal ([Oaths](oaths.md) "Choices and explicit acceptance").
- Stored rule text is never replaced by a paraphrase. A summary may sit on top only while every rule stays reachable before acceptance ([visual polish](oath-visual-polish.md) "Proposed experience", item 3).
- The backend owns state and time. A device countdown never declares failure, success or any state change ([Oaths](oaths.md) "Today, detail, history and pause", [visual polish](oath-visual-polish.md) item 4).
- Today groups dates in each commitment's stored zone and labels that zone. History keeps terminal timestamp order ([Oaths](oaths.md)).
- The full rule text stays in the app. Removing it needs an owner decision (owner instruction, 2026-09-28).
- PL and EN, no em dash and no semicolon in copy, Reduce Motion and simple layout keep static equivalents, controls at least 44 pt.

Out of scope: proof upload, XP grants, Recovery creation, notifications, API or schema changes, new states, Android.

## Screens

### 1. Calendar (item 1)

The date sheet of `WallTimePicker` gets three changes. "Today" means the current date in the zone chosen in the picker, from the device clock corrected by the last known server offset (see "Countdown").

- Today's cell has a bronze ring and the label "Dziś" / "Today" for VoiceOver.
- Days before today are dimmed and not pressable (`accessibilityState.disabled`). The previous-month arrow is disabled while the shown month is the current month.
- On today's date, hours and minutes that already passed are disabled too (decision Q3).
- The grid carries one row of short weekday names, Monday first, from the sheet's locale. VoiceOver skips it, because each day already speaks its full date. The large-text layout lists whole dates and has no such row. The previous-month control points back, with its chevron before the label (native check, 2026-09-30).
- On today's date the time sheet opens on the first minute after now when the stored or default time has passed. With no minute left today it keeps the stored or default time, and the action stays disabled (native check, 2026-09-30).
- Each sheet reads the corrected clock when it opens. The shown month, today's ring, the disabled days, hours and minutes and the opening time all use that moment, so an idle form does not open on a time that passed meanwhile (review, 2026-09-30).

The server keeps rejecting past times (`activation_elapsed`, `deadline_not_after_activation`). The client check is a convenience, not the rule.

### 2. Rules before the Oath (item 2)

The review screen after "Zobacz zasady" keeps its order of promise, rules, consent and the "Złóż Przysięgę" action, but the rules become cards.

Rule cards, each with an icon from `graphics/mvp-21/incoming/oath-rule-icons-v01.png`, a short title and the value from the preview snapshot:

| Card | Icon | Value shown | Title PL / EN (proposal) |
| --- | --- | --- | --- |
| Start | Sunrise over the forge | Activation: now, or the local time with zone | Start / Start |
| Deadline | Hourglass | D, local time with zone | Termin / Deadline |
| Last moment for proof | Candle | S, local time, "15 minut po terminie" | Ostatni moment na dowód / Last moment for proof |
| Proof | Framed runner | Both evidence alternatives by name | Dowód / Proof |
| Review | Scales | Review window from the snapshot policy | Rozpatrzenie / Review |
| Fixed rules | Anvil with a lock | "Po złożeniu zasady się nie zmienią." / "Once made, the rules do not change." | Zasady są stałe / The rules are fixed |
| Pause | Door with the moon | One line on pause and withdrawal | Pauza / Pause |
| Reward | New icon | Reward policy from the snapshot | Nagroda / Reward |
| Consequence | New icon | Consequence policy from the snapshot | Jeśli nie zdążysz / If you miss it |

Values are formatted from snapshot fields, never from the device's current settings. Card titles and lines were accepted by the owner (decision Q5) and may still be tuned after native checks. The promise and the declaration stay as text above the cards, because the player accepts them. Start, deadline and last-moment cards show the hour large on its own line, with the day and zone or the grace period under it, so a half-width card never breaks a date at random (owner request, 2026-09-29). The promise names the deadline to the minute with a short offset, for example "29 września 2026 o 07:43 · UTC+2". The full rules keep the zone, the offset and the seconds (owner decision, 2026-09-29).

Below the cards a scroll icon opens "Pełne zasady" / "Full rules": the complete stored `SnapshotRules`, unchanged. It starts folded (decision Q1). The consent line becomes "Wybierając „Złóż Przysięgę”, akceptuję zasady z kart i pełne zasady." / "By choosing “Commit to the Oath”, I accept the rules on the cards and the full rules."

The reward and consequence cards let the player see both without opening the full rules (decision Q2).

**Żaromir the first time.** The first time a player reaches the review screen, Żaromir's dialogue panel (the MVP-20 `DialoguePanel`) rises over the bottom of the screen. Each line lights the card it names. Accepted lines (decision Q5):

| Line | Polish | English |
| --- | --- | --- |
| 1 | Zanim złożysz Przysięgę, poznaj jej zasady. Każda karta to jedna z nich. | Before you make the Oath, meet its rules. Each card is one of them. |
| 2 | Klepsydra to termin. Do niego wykonujesz zadanie. | The hourglass is the deadline. Finish the task by then. |
| 3 | Świeca to ostatni moment na dowód, kwadrans po terminie. | The candle is the last moment for proof, 15 minutes after the deadline. |
| 4 | Kowadło z kłódką mówi, że po złożeniu nic tu się nie zmieni. | The anvil with the lock says nothing here changes once you make it. |

The last line offers "Zakończ" / "Finish" instead of "Dalej" / "Next", because it closes the explanation. The × skips the explanation. A small Żaromir button on the screen replays it. The "seen" flag is stored like the first-visit guide flag, in device storage per account (decision Q4). Simple layout and Reduce Motion show the lines without typing, in a static panel.

### 3. Making the Oath (item 3)

The animation starts only after the server confirms acceptance, never on the tap. The existing lost-response retry keeps working: the animation plays once, when the confirmed Oath first appears.

1. Sealing, about 1.2 s: the scroll from `oath-seal-stamp-v04.png` fills the top of the screen, the stamp presses the wax and lifts, and sparks from `oath-seal-sparks-v01.png` burst once. The sparks need an alpha export, because a screen blend drew a dark square inside a panel in MVP-20.
2. Confirmation card:
   - The activity emblem and the sealed wax with its flame.
   - Title "Przysięga złożona" / "Oath made".
   - The countdown in large type with the animated hourglass (`countdown-hourglass-v05.png`), for example "Do terminu: 2 d 5 h" / "Until the deadline: 2 d 5 h". Above a text scale of 1.3 every countdown chip, in lists, here and in the detail, stands its label over the value, so it keeps to its text instead of filling the width.
   - One line with D in its local time and zone, and the state label from the server.
   - Actions: "Zobacz Przysięgę" / "View the Oath" (detail with the full rules) and "Wróć do Kuźni" / "Back to the Forge". "Nowa Przysięga" stays available.

The full rules no longer repeat on this card. They stay one touch away in the detail. Reduce Motion shows the sealed frame and a still hourglass. The app learns the motion preference shortly after the screen opens, so the unsealed scroll shows for up to 400 ms first (native check, 2026-09-30). VoiceOver announces "Przysięga złożona" and the countdown once.

### 4. Your Oaths (item 4)

Each row of the Today list becomes a card:

- Activity emblem, activity name, state seal and state label (existing `StateSeal`).
- A countdown chip with a small still hourglass, for example "2 d 5 h".
- A short deadline such as "pt 18:00" / "Fri 18:00" in the Oath's stored zone. The zone label stays in the group header, as the Oaths contract requires. The long line with zone and UTC offset moves to the detail.

The featured seals of `ForgeHub` and the section headers stay, with the same countdown chip. Rows keep server order.

Seal wall polish (native check on iPhone 18 Pro, 2026-09-28):
- Each seal shows a short one-line state, for example "Rozpatrywana" / "Under review". The seal button still speaks the full state.
- The seal chip stacks its label over one unbroken value and fills the column. All three chips sit on one line at the bottom of the row.
- "Wszystkie Twoje Przysięgi" / "All your Oaths" opens the list with a rule and a display heading. The date and zone line is smaller and repeats under every state section, so each group keeps its zone label.

Lists keep themselves current (owner decision, 2026-09-29). There is no "Odśwież" / "Refresh" button. Today and History ask the server again when the app returns to the foreground, when the device gets its network back and when a countdown reaches zero, and a pull-down gesture refreshes them as in other iOS apps. The shown list stays until the answer replaces it. An open detail or creation is left alone.

Refresh practice (research, checked 2026-09-29). Apple asks apps not to make people start every update and treats the refresh control as a way to load content before the next automatic update ([HIG, progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)). Common client practice refetches stale data on foreground, screen focus and network reconnect ([TanStack Query important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)). Oath state changes at known moments, so these events and the countdowns replace timed polling (local decision). Silent push is throttled to a few per hour and may be dropped, so it is not an update path ([Apple, background updates](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app)).

Reconnect (owner decision, 2026-09-29). `expo-network` reports connection changes ([Expo Network for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/network/)). Only a change from offline to online refetches, so the first reading and repeated reports never do. Internet reachability counts when the platform knows it, the link state otherwise. The simulator demo's offline control stands in for the network, because the simulator's own connection does not drop.

Proof verdict updates (owner decision, 2026-09-29, not implemented, because the proof screen does not exist yet). A visible notification announces the verdict and also refetches an open list. While the proof screen waits for a verdict, it polls with growing gaps of 3, 5, 10 and 20 seconds, then every 20 seconds, for about 2 minutes in total. After that it stops and the player sees the pending state until a notification, a foreground return or a pull-down. Growing gaps follow the common exponential backoff practice ([AWS, exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)). The exact steps are a local decision.

### 5. History and detail (item 6)

History rows show the result seal, the activity and a compact date, and touching a row opens the detail. The rows show no further text. The compact date uses 24-hour time with a two-digit hour in both languages, for example "30 wrz 2026, 23:12" / "Sep 30, 2026 at 23:12" (owner decision, 2026-10-01).

In the room layout the chronicle close-up is lowered like the seal wall, so the book fills a band under the tabs and no text crosses it (native check, 2026-09-29).

The top of History gets a short encouraging header: the chronicle icon with the server total of entries (the `history` list `total`, as in Żaromir's counter) and one of Żaromir's lines. Accepted lines (decision Q5):
- "Każdy wpis to Twoja historia w Kuźni." / "Every entry is part of your story in the Forge."
- With no entries: "Kronika czeka na pierwszy wpis." / "The chronicle is waiting for its first entry."

No per-state totals appear, because the API has none and counting loaded pages would mislead.

The detail uses the same layout as the review screen: the state seal and label, the countdown for nonterminal Oaths, the rule cards and "Pełne zasady" folded below. Terminal Oaths show their result and terminal date instead of a countdown. In the room layout the detail lowers the seal wall like Today, so the emblem stands on the middle plinth and the title and tabs sit on the dark band. The Oath title and activity follow, then one centred status panel holds the state, the countdown, the review or closing time in the Oath's own zone and the reason. The promise, declaration and rule cards come after it (native check, 2026-09-29). A `proof_pending` detail adds the assessment note and the server receipt time in the Oath's zone to that panel. A proof copy still waiting on the device shows as an interrupted upload under the panel and on the Today row, with a resend (MVP-07-T10).

## Countdown

- **Clock:** every envelope carries `serverTime`. The client stores `offset = serverTime − device time at receipt` and uses `now = device time + offset`. The offset updates with each envelope.
- **Target by state:**

  | State | Counts down to | Label PL / EN |
  | --- | --- | --- |
  | `scheduled` | Activation | Start za / Starts in |
  | `active` | D | Do terminu / Until the deadline |
  | `review_pending` | `review.closesAt` | Do końca / Ends in |
  | Other states | No countdown | none |

- **Format:** at least one day "2 d 5 h", under a day "5 h 12 min", under an hour "12 min", under a minute "< 1 min". VoiceOver reads full words ("2 dni 5 godzin" / "2 days 5 hours") and is not a live region.
- **Ticks:** the countdown updates once a minute, aligned to the minute, and again when the app returns to the foreground.
- **At zero:** the chip shows "Czas minął" / "Time is up" in neutral color. The state label does not change. The screen asks the server for a fresh list once. Only the server's answer changes the state.

## Unhappy paths

| Case | Behavior |
| --- | --- |
| Acceptance fails or conflicts | No animation. Existing error copy and recovery stay. |
| Acceptance reply lost, then replayed | The animation plays once, when the confirmed Oath appears. |
| Device clock wrong | The countdown uses the server offset, and the calendar marks today from the corrected clock. |
| No envelope received yet (offline start) | Countdowns hide rather than guess. Row and detail still show D. |
| Countdown reaches zero on screen | Neutral "Czas minął" and one refresh. No local state change. |
| Paused character | Rows keep the server state. Countdowns follow the table. |
| Large text or simple layout | Cards stack in one column, the countdown wraps, and nothing is hidden. |
| Reduce Motion | No stamping, typing or sand motion. Final frames show at once. |

## Art

Candidates in ignored `graphics/mvp-21/incoming/` (review notes in `graphics/mvp-20/incoming/feedback-review-2026-09-28.md`):

| File | Use | Open review point |
| --- | --- | --- |
| `oath-rule-icons-v01.png` | Seven rule cards and the full-rules scroll | The sunrise is too detailed at 40 pt, so it needs a simpler version or a check on device |
| `oath-seal-stamp-v04.png` | Sealing | Stabilized script output, 444 px cells |
| `oath-seal-sparks-v01.png` | Sealing sparks | Needs an alpha export |
| `countdown-hourglass-v05.png` | Countdown | Subtle stream loop, and the list uses the first frame still |

Exports are listed in the manifest [Oath screens assets](../art/oath-screens-assets.md) with provenance and SHA-256, following the [art pipeline](../art/pipeline.md). Decision Q2 needs two more icons for reward and consequence. Until they exist the cards use a marked DUMMY icon from the current sheet.

The demo's art style row (owner decision 2026-09-29, demo only) switches these screens to the [cinematic style](../art/cinematic-assets.md). Today it changes Żaromir in the companion bubbles and the room behind the list screens. Rule icons, the seal, the hourglass, the station close-ups and the bust keep their v01 files until cinematic versions exist.

## Acceptance

- The calendar marks today, and past days and past times today cannot be chosen. The server still rejects a forged past time.
- Before acceptance the review screen shows the rule cards with snapshot values, the promise and the declaration, and it opens the complete stored rules unchanged.
- The first review shows Żaromir's four lines once per account on the device. They can be skipped and replayed.
- After server-confirmed acceptance the seal animation plays once, then the confirmation card shows the countdown to D. Reduce Motion shows the final state.
- Every Today row shows a countdown chip that follows the state table and never changes the state at zero.
- History rows show the seal, the activity and the date, the header shows the server total, and the detail keeps the full rules reachable.
- PL and EN native checks on the iPhone 18 Pro. Other sizes are recorded as not verified.

## Owner decisions

Answered by the owner on 2026-09-28. Each answer took the recommended option.

- **Q1. Full rules before acceptance:** folded under "Pełne zasady" below the cards, with the new consent line in section 2.
- **Q2. Reward and consequence cards:** added, with values from the snapshot and two new icons.
- **Q3. Past times today:** hours and minutes that passed today are disabled too.
- **Q4. When Żaromir explains the rules:** the first review per account on this device.
- **Q5. Copy:** card titles and lines, Żaromir's lines and the History header are accepted as written.
