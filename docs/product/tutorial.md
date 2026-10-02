# Żaromir tutorial: the Forge rules

Status: accepted specification, owner decisions of 2026-09-27 during brainstorming (sub-project 3 after the [main menu](main-menu.md)). Implemented locally in MVP-19 on 2026-09-27 and checked natively in the development demo, see [tutorial acceptance](../engineering/testing.md#tutorial-acceptance-mvp-19-2026-09-27). Pending: owner visual acceptance and VoiceOver (deferred by the owner).

## Purpose

The four-step room guide only names the places. The player also needs the rules that already work: how an Oath is made, what the Forge does with it and what pause and characters change. Żaromir explains them in the Forge room, and the player picks the place to hear about.

**Local decisions: owner instruction, 2026-09-27.**

- The tutorial teaches the game rules, not a guided first Oath and not lore.
- It covers only behavior that works in the app today. Evidence submission, AI assessment, XP, rewards and Recovery get their own chapters when those features exist. The player never reads a promise the app cannot keep.
- It is a conversation in the room. The player touches a place, the player and Żaromir walk there, the player asks one question and Żaromir explains it in a few lines of the dialogue panel (MVP-20, [Forge scene](forge-scene.md)).
- The first room entry keeps the short four-step guide. The Tutorial tile in the menu starts the full conversation.
- In simple layout the same chapters appear as one plain text screen. Superseded on 2026-10-02: each chapter folds behind its title, see [clarity](clarity.md).

Superseded by [engagement](engagement.md) on 2026-10-02 (delegated decision, owner review pending, implemented locally in MVP-22-E2.2 to E2.4, native check pending): in the room each chapter plays one bark of at most 12 words while Żaromir gestures at the place, and "Więcej" / "More" plays the chapter's other existing lines (D-E8). The first room entry no longer plays the four-step guide. Only the hearth is lit and the other places light when they have something (D-E7). Proof submission, which works since MVP-07, is taught at the moment of use on the first proof screen instead of in a new chapter (D-E9).

## Flow

| From | Action | To |
| --- | --- | --- |
| Menu | Tutorial, room layout | Forge room in tutorial mode, choice bubble |
| Menu | Tutorial, simple layout | Tutorial screen |
| Choice bubble | Touch the hearth, seals, chronicle or door | Both walk there, the player's question, then the chapter starts at line 1 |
| Chapter bubble | Next | Next bubble of the chapter |
| Last chapter bubble | Another place | Choice bubble, the place is marked as heard |
| Last bubble of the fourth heard chapter | Finish | Closing bubble |
| Closing bubble | Finish | Normal room |
| Any tutorial bubble | × | Normal room |
| Tutorial screen | Back to menu | Menu |

**Tutorial mode.** Every place and the door glow as selectable. Touching the door plays its chapter and does not leave the room. The station actions ("Shape an Oath" and the others) do not appear in tutorial mode. After the tutorial ends the room behaves as usual and the door leads to the menu.

**Choice bubble.** When the tutorial starts, Żaromir walks into the room from the entrance to a place in front of the hearth, above the bubble. After a chapter he waits at that chapter's place without its station pose. While the player chooses, he explains and points toward the places. At a told place he first works facing it, then turns and talks to the player (local decision, MVP-18-T12, 2026-09-27). The first choice uses the intro line. A return after a chapter uses the "again" line. Heard places show a small gold check and their accessibility label adds "heard". Superseded on 2026-10-02: the check is a gold plate with a word, "✓ Wysłuchane" / "✓ Heard", see [clarity](clarity.md). A heard place can be played again.

**Chapter bubble.** It keeps the existing room bubble: speaker name, text, a step counter such as "2 / 4", a next button and ×. The last bubble replaces next with "Another place". When it is the fourth distinct heard chapter, the button is "Finish" and leads to the closing bubble. Touching the place being told keeps the current line. At the door Żaromir stands in the doorway.

Superseded on 2026-10-02 (MVP-22-E2.3, [engagement](engagement.md) D-E8, owner review pending): a touched place now opens on Żaromir's bark, without the player's question or a counter. Its controls are "Więcej" / "More" where the counter sits and "Inne miejsce" / "Another place", or "Zakończ" / "Finish" on the fourth distinct place. A bark alone counts the chapter as heard. "Więcej" plays the player's question, then the chapter lines above with their counter, and the last line keeps "Another place" or "Finish" (local decision). The bark copy is in [engagement](engagement.md#status). The simple tutorial screen keeps only the chapter lines.

**Progress.** Heard marks live only for the current tutorial run. Nothing is stored, locally or on the server. A new start from the menu begins with no marks.

**First visit.** The automatic guide on the first room entry stays four steps. Its last step now points to the Tutorial. A tutorial started before the first room entry takes priority, the guide does not start and the guide counts as seen.

Superseded by [engagement](engagement.md) on 2026-10-02 (delegated decision, owner review pending, implemented locally in MVP-22-E2.2): the first room entry lights only the hearth with one bark from Żaromir. Unlit places stay touchable and say when they light. Unknown counts light every place (D-E7).

**Simple layout.** The Tutorial tile is visible again in simple layout, full width like Settings. It opens a scrolling screen with Żaromir's portrait, the intro line and the four chapters, each with a heading and its bubbles as paragraphs. Superseded on 2026-10-02: each chapter heading is a link that opens its paragraphs in place, so the screen shows the intro and four titles first, see [clarity](clarity.md). A plain "Back to menu" link returns to the menu. The copy is the same as in the room.

## Copy

Rules for all lines: Żaromir speaks calmly in the first person and addresses the player without gendered verb forms, because the player's grammatical form belongs to the character. Each bubble stays short enough for the room bubble on a 375 × 667 pt screen. No em dashes and no semicolons.

### Frame

| Key | Polish | English |
| --- | --- | --- |
| `room.tutorial.intro` | Opowiem Ci o zasadach Kuźni. Dotknij miejsca, o którym chcesz posłuchać. | I will tell you how the Forge works. Touch the place you want to hear about. |
| `room.tutorial.again` | Dotknij kolejnego miejsca albo zamknij rozmowę. | Touch another place or close our talk. |
| `room.tutorial.end` | To wszystko, co dziś obowiązuje w Kuźni. Samouczek czeka w menu, gdy zechcesz wrócić. | Those are all the rules the Forge follows today. The Tutorial stays in the menu whenever you want to come back. |
| `room.tutorial.next` | Dalej | Next |
| `room.tutorial.another` | Inne miejsce | Another place |
| `room.tutorial.finish` | Zakończ | Finish |
| `room.tutorial.close` | Zamknij samouczek | Close the tutorial |
| `room.tutorial.hear` | Posłuchaj: {{place}} | Hear about: {{place}} |
| `room.tutorial.heard` | wysłuchane | heard |
| `room.tutorial.heardMark` | Wysłuchane | Heard |
| `room.door` | Drzwi | Door |

### Chapters

| Key | Polish | English |
| --- | --- | --- |
| `room.tutorial.titles.hearth` | Palenisko · Składanie Przysięgi | Hearth · Making an Oath |
| `room.tutorial.hearth.1` | Przy palenisku wybierasz trening: bieganie, trening siłowy albo mobilność. | At the hearth you choose a workout: running, strength training or mobility. |
| `room.tutorial.hearth.2` | Ustalasz start, teraz albo w wybranym terminie, i późniejszy termin ukończenia. | You set a start, now or at a time you choose, and a later deadline to finish by. |
| `room.tutorial.hearth.3` | Zanim złożysz Przysięgę, zobaczysz wszystkie jej zasady. Tworzy ją dopiero Twoja wyraźna zgoda. | Before you make the Oath, you see all its rules. It is made only when you explicitly accept them. |
| `room.tutorial.hearth.4` | Złożonych zasad nikt już nie zmieni, także Kuźnia. Inna obietnica to nowa Przysięga. | Once it is made, no one can change its rules, not even the Forge. A different promise means a new Oath. |
| `room.tutorial.titles.seals` | Pieczęcie · Bieżące Przysięgi | Seals · Current Oaths |
| `room.tutorial.seals.1` | Pieczęcie to Twoje bieżące Przysięgi: zaplanowane, trwające i te, które czekają na wynik. | The seals are your current Oaths: scheduled, active and those awaiting a result. |
| `room.tutorial.seals.2` | Każda Przysięga trzyma czas w swojej strefie. Zmiana strefy w telefonie go nie przesunie. | Each Oath keeps its times in its own timezone. Changing your phone’s timezone does not move them. |
| `room.tutorial.seals.3` | O stanie decyduje Kuźnia, nie zegar w telefonie. Po ostatnim terminie Przysięga jest pod rozwagą, a nie niewykonana. | The Forge decides the state, not your phone’s clock. After the last deadline the Oath is under review, not missed. |
| `room.tutorial.titles.chronicle` | Kronika · Zakończone Przysięgi | Chronicle · Finished Oaths |
| `room.tutorial.chronicle.1` | Kronika przechowuje zakończone Przysięgi razem z ich wynikiem. | The chronicle keeps your finished Oaths and their results. |
| `room.tutorial.chronicle.2` | Zapisów w kronice nikt nie przepisuje. Każda Przysięga zachowuje zasady przyjęte przy jej złożeniu. | Nobody rewrites the chronicle. Each Oath keeps the rules you accepted when you made it. |
| `room.tutorial.titles.door` | Drzwi · Postacie i pauza | Door · Characters and pause |
| `room.tutorial.door.1` | Drzwi prowadzą do menu. Tam zmienisz postać albo stworzysz nową, najwyżej trzy. | The door leads to the menu. There you can switch characters or create a new one, up to three. |
| `room.tutorial.door.2` | Każda postać ma własne Przysięgi, własną kronikę i własną pauzę. | Each character has its own Oaths, chronicle and pause. |
| `room.tutorial.door.3` | Pauza, włączana w Ustawieniach, wycofuje zaplanowane i trwające Przysięgi tej postaci. Czekające na wynik trwają dalej. | When you turn it on in Settings, pause withdraws this character’s scheduled and active Oaths. Those awaiting a result continue. |
| `room.tutorial.door.4` | W czasie pauzy nie złożysz nowej Przysięgi. Wznowienie zdejmuje pauzę, ale nie przywraca wycofanych. | While paused you cannot make a new Oath. Resuming lifts the pause but does not restore withdrawn Oaths. |

Superseded on 2026-10-02: the review state is named with the set phrase "pod rozwagą", and `seals.3` and `door.3` keep two sentences each. The table above shows the current copy. See [clarity](clarity.md).

Superseded on 2026-10-02 (MVP-22-A8c): the English `seals.1` names the review state "under review", as `seals.3` and `door.3` do, and the English `door.3` says again that the player turns pause on in Settings.

Superseded on 2026-10-02 (MVP-22-B4, final copy review): `seals.1` and `door.3` name every Oath awaiting a result, not only those under review. Current Oaths also hold a pending proof and a proof that needs more, and pause keeps all of them. The Polish `seals.3` ends "a nie niewykonana".

Superseded on 2026-10-02 (MVP-22-C1, native English pass): the English `end`, `hearth.2`, `hearth.3`, `hearth.4`, `chronicle.1`, `chronicle.2` and `door.1` were rewritten to read as native English with the same rules. The tables above show the current copy. The Polish lines are unchanged.

Rule sources for the chapters: [creating and tracking Oaths](oaths.md), [first-loop pause rules](first-loop.md#pause-and-alternatives) and [player characters](player-character.md).

### Changed copy

| Key | Polish | English |
| --- | --- | --- |
| `room.guide.door` | Drzwi w blasku księżyca prowadzą do menu. Zasady Kuźni opowiem w Samouczku. | The moonlit door leads to the menu. Find me in the Tutorial to learn the Forge rules. |
| `menu.tutorialDetail` | Żaromir wyjaśni zasady | Learn the rules from Zharomir |
| `tutorial.title` (simple screen) | Zasady Kuźni | Forge rules |

Superseded on 2026-10-02 (MVP-22-C1, native English pass): the English `room.guide.door` and `menu.tutorialDetail` were rewritten. The old door line wrapped onto a lone "I", and both read as translated. The table shows the current copy.

## Engineering

**Local decisions: owner approval of approach A, 2026-09-27.**

- `apps/mobile/src/forge/tutorialChapters.ts` lists the chapters in order with their place and bubble count. The room and the simple screen both read it, so the copy has one source.
- The home route drops the `guide` restart id, because the guide now starts only on the first room entry. `openTutorial` receives the layout: room layout gives `{ kind: 'forge', tutorial: id }`, simple layout gives `{ kind: 'tutorial' }`. Back from the tutorial screen returns to the menu. Route resets on account or character change stay as they are.
- `ForgeRoom` gets a `tutorial?: number` prop, a new id restarts the tutorial. The room holds one mode: guide, tutorial or none. The existing walking, lights and Reduce Motion equivalent are reused. The room reports the start (the parent marks the guide seen) and the end (the parent clears the id, so a remount after a background return does not start a closed tutorial again).
- Tutorial bubbles keep their bottom edge while paging, so the button stays under the finger. On iPhone SE 3 the longest lines raise the bubble over Żaromir's legs rather than hiding text behind a scroll (local decision, native check 2026-09-27, open for owner visual acceptance).
- Polish text in the room bubble and on the tutorial screen keeps single-letter words (a, i, o, u, w, z) with the next word through a non-breaking space (`apps/mobile/src/localization/typography.ts`, local decision, native check 2026-09-27).
- MVP-20 replaced the room bubble (`RoomBubble.tsx`, removed) with the dialogue panel `apps/mobile/src/forge/DialoguePanel.tsx`. It keeps its bottom edge, grows upward and never covers the station touch areas. The step counter counts only Żaromir's lines.
- `apps/mobile/src/home/TutorialScreen.tsx` renders the simple layout with the existing `BackLink` and text caps from `tokens.maxScale`.
- The menu shows the Tutorial tile in both layouts.

## Acceptance

- Mobile tests, each written failing first:
  - route reducer for both layouts and back
  - `ForgeRoom` tutorial: choice bubble, chapter with counter, another place, heard marks, door plays its chapter, × ends, finish after four chapters, no guide during the tutorial, restart id
  - `TutorialScreen`: all chapters in order, back to menu, largest text without clipping
  - catalog: every chapter key in both languages, no em dash or semicolon
  - menu: Tutorial tile in simple layout
- Native checks on iPhone SE 3 and iPhone 18 Pro, Polish and English, against the [visual quality bar](../art/ui-system.md#visual-quality-bar): every bubble of every chapter fits, heard marks, closing bubble, largest text on the simple screen, Reduce Motion.
- VoiceOver stays deferred by owner decision, 2026-09-26. Labels are still set for every control.

## Out of scope

Chapters about evidence, AI assessment, XP, rewards and Recovery until those features work. Saved tutorial progress. New Żaromir art or poses. A guided first Oath. Android.
