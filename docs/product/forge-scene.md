# Forge scene: the player, Żaromir and the dialogue panel

Status: accepted design, owner decisions of 2026-09-28 during brainstorming. Written for owner review before planning (MVP-20). Nothing below is implemented yet. It builds on the [main menu](main-menu.md) room, the [tutorial](tutorial.md) and the [Forge motion assets](../art/forge-motion-assets.md).

## Purpose

The owner found the room below the bar: the bubbles are plain, the book and seal responses are weak and the player is absent. The Forge becomes a scene with two characters. The player walks the room and handles each place. Żaromir guides, then steps aside and becomes the one to ask about progress.

**Local decisions: owner instruction, 2026-09-28.**

- The player character walks in the Forge. Żaromir encourages the player to look at the places.
- During the tutorial and the first-visit guide Żaromir moves to a spot near the place the player goes to, so his explanation feels natural.
- After the tutorial Żaromir stands aside. Touching him opens a hint and the player's statistics.
- The player gets the full animation set: eight walk directions, breathing and four place poses, for every preset and build.
- The dialogue panel is a carved RPG panel with the speaker's bust.
- The player speaks short lines, about one per place and one per tutorial chapter.
- Places respond in the room when the player arrives, and the camera flies to the place when the player picks its action. This applies to the hearth, the seals, the chronicle and the door.
- Delivery goes code first with a DUMMY player figure, art in parallel, then the art is swapped in.

## Room modes

| Mode | When | Żaromir |
| --- | --- | --- |
| Guided | The first-visit guide and the tutorial | Walks with the player to his own spot beside the chosen place, turns to the player and explains |
| Normal | Every other room visit | Stands aside near the anvil, right of the hearth, breathing. Touching him opens the hint and statistics |

Simple layout at large text keeps its current screens without the room or characters.

## The player in the room

- The active character appears at the start point in the lower middle of the room, drawn from its preset and build.
- Touching a place walks the player to the player spot of that place. Walk direction, eight-frame cycle, distance-based time and depth size follow the rules already used for Żaromir.
- On arrival the player plays the pose facing the place: stirring the fire, raising a light to the seals, reading at the lectern, looking out of the door. The place responds at the same moment.
- The panel then shows the player's line, Żaromir's line and the place action.
- At the door in normal mode the player looks out, then the camera pulls back and the menu opens. In the tutorial the door is a chapter, as today.
- Reduce Motion places both characters at once in the first frame of their pose.

Each place has two stand spots, one for the player and one for Żaromir, chosen so the figures never overlap. Characters are drawn in depth order, lower on screen in front. The seal foreground cut covers either character standing behind the seals.

Until the player art is delivered the player is the static menu figure of the character, marked DUMMY. It moves without step animation.

## Żaromir

- Guided mode: he starts walking together with the player, to his spot beside the chosen place. On arrival he turns to the player and talks with the existing gestures. The tutorial chapter text stays as accepted.
- Normal mode: he stands aside and breathes. He does not follow the player.
- Touching him in normal mode turns him to the player and opens the panel with one hint and the statistics card. His touch target has a VoiceOver label, "Żaromir, your progress" / "Żaromir, twoje postępy".

## Dialogue panel

- A dark carved wood panel with bronze fittings sits at the bottom of the room. A name plate names the speaker.
- The speaker's bust rises above the frame. Żaromir is on the left, the player on the right. A change of speaker slides the old bust out and the new one in, and the plate moves to that side.
- A soft ring of light under the speaking character in the room shows who speaks. The panel has no tail.
- Text appears letter by letter. The first touch shows the whole line, the next touch continues. A pulsing rune in the corner shows that more follows.
- The panel keeps today's controls: the place action as a bronze button, the counter such as "2 / 4", "Another place", "Finish" and ×.
- The bottom edge stays fixed and the panel grows upward, so a button never moves under the finger. At large text the content scrolls inside the panel.
- VoiceOver reads the speaker and the whole line at once. Busts are decorative. Controls are at least 44 pt.
- Reduce Motion shows the whole line at once and swaps busts without sliding.
- The same panel serves the first-visit guide, the tutorial, place descriptions and the talk with Żaromir.
- Until the painted frame, plate and rune are delivered, code draws them. The player bust is the preset portrait. Żaromir needs a new transparent bust.

## Place responses and camera

Object layers are cut from the room image: the three seal drums, the book and the door leaf. Code moves the cut layers, and generated sprites add light only. This avoids a generated object that does not match the room pixels.

| Place | Response on arrival |
| --- | --- |
| Hearth | The current flare, plus the coals brightening |
| Seals | One after another, each drum turns on its axis, its motif lights from the centre and sparks fall |
| Chronicle | The pages flutter over the book and glowing signs rise from it |
| Door | The current mist, plus the door leaf swinging slightly |

Touching the place again replays its response.

When the player picks the place action, the camera flies to the object, about 1.9 times over 650 ms, crossfades into the matching station close-up and opens the screen. Returning to the Forge plays it backward. The door pulls the camera back and opens the menu. Reduce Motion uses a crossfade only. The transition delays navigation by at most 700 ms and ignores a second touch while it runs.

## Hint and statistics

Touching Żaromir in normal mode shows one hint line and a statistics card in the panel.

| Condition, first match | Polish | English |
| --- | --- | --- |
| Character paused | Twoja pauza trwa. Kiedy zechcesz wrócić, zajrzyj do Ustawień. | Your pause is on. When you want to return, look in Settings. |
| No current Oaths | Ogień czeka. Przy palenisku ukształtujesz pierwszą Przysięgę. | The fire is waiting. At the hearth you can shape your first Oath. |
| Current Oaths | Masz bieżące Przysięgi: {{count}}. Zajrzyj do pieczęci. | You have {{count}} current Oaths. Take a look at the seals. |
| Counts unavailable | Nie widzę dziś kroniki wyraźnie. Spróbuj za chwilę. | I cannot read the chronicle clearly right now. Try again in a moment. |

The card shows the character name, the title of the character's form (existing `character.form` copy, for example "Obrońca Przysięgi", "Obrończyni Przysięgi" or "Straż Przysięgi", English "Oathkeeper"), the build ("Wątła" / "Tęga", "Slight" / "Stout"), the number of current Oaths and the number of chronicle entries. Counts come from the Oath list `total` of the `today` and `history` views, the same source as the menu. XP and level do not appear until MVP-09 grants them. The Polish plural of the count follows the existing plural rules.

## Player lines

One player line opens each place description and each tutorial chapter. Polish lines agree with the character's form (masculine, feminine or neutral). The neutral form avoids gendered past tense. The lines below are proposals for owner review, written without em dashes or semicolons.

Lines without a gendered form use one Polish text for all forms.

| Key | Polish | English |
| --- | --- | --- |
| `hearth` | Ten ogień aż parzy. Co tu się wykuwa? | This fire burns hot. What is forged here? |
| `seals` | Te pieczęcie świecą. Czyje to obietnice? | These seals are glowing. Whose promises are they? |
| `chronicle` | Kto to wszystko zapisał? | Who wrote all of this down? |
| `door` | Już mam wyjść? | Should I leave already? |
| `tutorial.hearth` | Pokaż mi, jak to się zaczyna. | Show me how it begins. |
| `tutorial.seals` | Co znaczą te znaki? | What do these marks mean? |
| `talk` | Jak mi idzie? | How am I doing? |

Lines with a gendered form:

| Key | Masculine | Feminine | Neutral | English |
| --- | --- | --- | --- | --- |
| `tutorial.chronicle` | Czy tu zostanie wszystko, co zrobiłem? | Czy tu zostanie wszystko, co zrobiłam? | Czy tu zostanie wszystko, co uda mi się zrobić? | Will everything I did stay here? |
| `tutorial.door` | A jeśli będę musiał przerwać? | A jeśli będę musiała przerwać? | A jeśli przyjdzie mi przerwać? | And if I have to stop? |

## Art needed

| Asset | Count | Notes |
| --- | --- | --- |
| Player walk, eight directions | 96 sheets | 12 figures, each 8-frame 4 × 2, pilot `starter_02` thin first |
| Player breathing | 12 sheets | As Żaromir's idle |
| Player place poses | 48 sheets | Hearth, seals, chronicle, door, each 4-frame 2 × 2 |
| Żaromir bust | 1 | Transparent, head and shoulders |
| Panel frame, name plate, rune | 3 | Nine-slice frame, plate, rune with glow |
| Seal motif glow | 3 | Star, tree and wolf, light only on black |
| Book page flutter and rising signs | 2 | Flutter matched to the lectern book, signs on black |

Masters stay in ignored `graphics/mvp-20/`. Exports follow the [art pipeline](../art/pipeline.md) and are recorded in a new manifest.

## Acceptance

- The player walks to every place in the eight directions and plays its pose. Żaromir reaches his own spot in guided mode and never overlaps the player.
- In normal mode Żaromir stays aside and his hint and statistics match the server counts and pause state.
- The panel shows both speakers, types the text, keeps its bottom edge and passes the existing bubble limits.
- Every place responds on arrival and on a repeated touch. The camera transition opens the right screen within 700 ms.
- Reduce Motion and simple layout keep static equivalents.
- Native checks on the iPhone 18 Pro (owner instruction, 2026-09-27) in Polish and English. Other sizes are recorded as not verified.

## Out of scope

XP, level and progression of the player's body. Player lines beyond those listed. Squad members in the room. Final room art selection, which stays a separate owner choice.
