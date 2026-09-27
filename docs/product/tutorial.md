# Żaromir tutorial: the Forge rules

Status: proposed specification, owner decisions of 2026-09-27 during brainstorming (sub-project 3 after the [main menu](main-menu.md)). Copy below awaits owner review. Nothing here is implemented.

## Purpose

The four-step room guide only names the places. The player also needs the rules that already work: how an Oath is made, what the Forge does with it and what pause and characters change. Żaromir explains them in the Forge room, and the player picks the place to hear about.

**Local decisions: owner instruction, 2026-09-27.**

- The tutorial teaches the game rules, not a guided first Oath and not lore.
- It covers only behavior that works in the app today. Evidence submission, AI assessment, XP, rewards and Recovery get their own chapters when those features exist. The player never reads a promise the app cannot keep.
- It is a conversation in the room. The player touches a place, Żaromir walks there and explains it in a few speech bubbles.
- The first room entry keeps the short four-step guide. The Tutorial tile in the menu starts the full conversation.
- In simple layout the same chapters appear as one plain text screen.

## Flow

| From | Action | To |
| --- | --- | --- |
| Menu | Tutorial, room layout | Forge room in tutorial mode, choice bubble |
| Menu | Tutorial, simple layout | Tutorial screen |
| Choice bubble | Touch the hearth, seals, chronicle or door | Żaromir walks there, chapter starts at bubble 1 |
| Chapter bubble | Next | Next bubble of the chapter |
| Last chapter bubble | Another place | Choice bubble, the place is marked as heard |
| Last bubble of the fourth heard chapter | Finish | Closing bubble |
| Closing bubble | Finish | Normal room |
| Any tutorial bubble | × | Normal room |
| Tutorial screen | Back to menu | Menu |

**Tutorial mode.** Every place and the door glow as selectable. Touching the door plays its chapter and does not leave the room. The station actions ("Shape an Oath" and the others) do not appear in tutorial mode. After the tutorial ends the room behaves as usual and the door leads to the menu.

**Choice bubble.** Żaromir stands in his idle place. The first choice uses the intro line. A return after a chapter uses the "again" line. Heard places show a small gold check and their accessibility label adds "heard". A heard place can be played again.

**Chapter bubble.** It keeps the existing room bubble: speaker name, text, a step counter such as "2 / 4", a next button and ×. The last bubble replaces next with "Another place". When it is the fourth distinct heard chapter, the button is "Finish" and leads to the closing bubble.

**Progress.** Heard marks live only for the current tutorial run. Nothing is stored, locally or on the server. A new start from the menu begins with no marks.

**First visit.** The automatic guide on the first room entry stays four steps. Its last step now points to the Tutorial. A tutorial started before the first room entry takes priority, the guide does not start and the guide counts as seen.

**Simple layout.** The Tutorial tile is visible again in simple layout, full width like Settings. It opens a scrolling screen with Żaromir's portrait, the intro line and the four chapters, each with a heading and its bubbles as paragraphs. A plain "Back to menu" link returns to the menu. The copy is the same as in the room.

## Copy

Rules for all lines: Żaromir speaks calmly in the first person and addresses the player without gendered verb forms, because the player's grammatical form belongs to the character. Each bubble stays short enough for the room bubble on a 375 × 667 pt screen. No em dashes and no semicolons.

### Frame

| Key | Polish | English |
| --- | --- | --- |
| `room.tutorial.intro` | Opowiem Ci o zasadach Kuźni. Dotknij miejsca, o którym chcesz posłuchać. | I will tell you how the Forge works. Touch the place you want to hear about. |
| `room.tutorial.again` | Dotknij kolejnego miejsca albo zamknij rozmowę. | Touch another place or close our talk. |
| `room.tutorial.end` | To wszystko, co dziś obowiązuje w Kuźni. Samouczek czeka w menu, gdy zechcesz wrócić. | That is everything the Forge follows today. The Tutorial waits in the menu whenever you want to return. |
| `room.tutorial.another` | Inne miejsce | Another place |
| `room.tutorial.finish` | Zakończ | Finish |
| `room.tutorial.close` | Zamknij samouczek | Close the tutorial |
| `room.tutorial.hear` | Posłuchaj: {{place}} | Hear about: {{place}} |
| `room.tutorial.heard` | wysłuchane | heard |
| `room.door` | Drzwi | Door |

### Chapters

| Key | Polish | English |
| --- | --- | --- |
| `room.tutorial.titles.hearth` | Palenisko · Składanie Przysięgi | Hearth · Making an Oath |
| `room.tutorial.hearth.1` | Przy palenisku wybierasz trening: bieganie, trening siłowy albo mobilność. | At the hearth you choose a workout: running, strength training or mobility. |
| `room.tutorial.hearth.2` | Ustalasz start, teraz albo w wybranym terminie, i późniejszy termin ukończenia. | You set the start, now or at a chosen time, and a later completion deadline. |
| `room.tutorial.hearth.3` | Zanim złożysz Przysięgę, zobaczysz wszystkie jej zasady. Tworzy ją dopiero Twoja wyraźna zgoda. | Before you make the Oath, you see all its rules. Only your explicit acceptance creates it. |
| `room.tutorial.hearth.4` | Złożonych zasad nikt już nie zmieni, także Kuźnia. Inna obietnica to nowa Przysięga. | Once made, its rules never change, not even by the Forge. A different promise is a new Oath. |
| `room.tutorial.titles.seals` | Pieczęcie · Bieżące Przysięgi | Seals · Current Oaths |
| `room.tutorial.seals.1` | Pieczęcie to Twoje bieżące Przysięgi: zaplanowane, trwające i te, które czekają na rozpatrzenie. | The seals are your current Oaths: scheduled, active and those awaiting review. |
| `room.tutorial.seals.2` | Każda Przysięga trzyma czas w swojej strefie. Zmiana strefy w telefonie go nie przesunie. | Each Oath keeps its times in its own timezone. Changing your phone’s timezone does not move them. |
| `room.tutorial.seals.3` | O stanie decyduje Kuźnia, nie zegar w telefonie. Gdy minie ostatni termin z zasad, Przysięga czeka na rozpatrzenie. To nie jest niewykonanie. | The Forge decides the state, not your phone’s clock. When the last deadline in its rules passes, the Oath awaits review. That is not a miss. |
| `room.tutorial.titles.chronicle` | Kronika · Zakończone Przysięgi | Chronicle · Finished Oaths |
| `room.tutorial.chronicle.1` | Kronika przechowuje zakończone Przysięgi razem z ich wynikiem. | The chronicle keeps finished Oaths together with their outcome. |
| `room.tutorial.chronicle.2` | Zapisów w kronice nikt nie przepisuje. Każda Przysięga zachowuje zasady przyjęte przy jej złożeniu. | Nobody rewrites the chronicle. Each Oath keeps the rules accepted when it was made. |
| `room.tutorial.titles.door` | Drzwi · Postacie i pauza | Door · Characters and pause |
| `room.tutorial.door.1` | Drzwi prowadzą do menu. Tam zmienisz postać albo stworzysz nową, najwyżej trzy. | The door leads to the menu. There you can switch character or create a new one, up to three. |
| `room.tutorial.door.2` | Każda postać ma własne Przysięgi, własną kronikę i własną pauzę. | Each character has its own Oaths, chronicle and pause. |
| `room.tutorial.door.3` | Pauzę włączysz w Ustawieniach. Wycofuje zaplanowane i trwające Przysięgi tej postaci. Te w rozpatrzeniu czekają dalej. | You can pause in Settings. It withdraws this character’s scheduled and active Oaths. Those under review keep waiting. |
| `room.tutorial.door.4` | W czasie pauzy nie złożysz nowej Przysięgi. Wznowienie zdejmuje pauzę, ale nie przywraca wycofanych. | While paused you cannot make a new Oath. Resuming lifts the pause but does not restore withdrawn Oaths. |

Rule sources for the chapters: [creating and tracking Oaths](oaths.md), [first-loop pause rules](first-loop.md#pause-and-alternatives) and [player characters](player-character.md).

### Changed copy

| Key | Polish | English |
| --- | --- | --- |
| `room.guide.door` | Drzwi w blasku księżyca prowadzą do menu. Zasady Kuźni opowiem w Samouczku. | The moonlit door leads to the menu. I explain the Forge rules in the Tutorial. |
| `menu.tutorialDetail` | Żaromir wyjaśni zasady | Zharomir explains the rules |
| `tutorial.title` (simple screen) | Zasady Kuźni | Forge rules |

## Engineering

**Local decisions: owner approval of approach A, 2026-09-27.**

- `apps/mobile/src/forge/tutorialChapters.ts` lists the chapters in order with their place and bubble count. The room and the simple screen both read it, so the copy has one source.
- The home route drops the `guide` restart id, because the guide now starts only on the first room entry. `openTutorial` receives the layout: room layout gives `{ kind: 'forge', tutorial: id }`, simple layout gives `{ kind: 'tutorial' }`. Back from the tutorial screen returns to the menu. Route resets on account or character change stay as they are.
- `ForgeRoom` gets a `tutorial?: number` prop, a new id restarts the tutorial. The room holds one mode: guide, tutorial or none. The existing walking, lights and Reduce Motion equivalent are reused.
- The room bubble moves to `apps/mobile/src/forge/RoomBubble.tsx`, because `ForgeRoom.tsx` already has 307 lines and gains the tutorial footer and heard marks. Its layout rules stay: it grows upward when taller than the space below and never covers the station touch areas.
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
