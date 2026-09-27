# Main menu, Settings and the Forge room

Status: accepted specification, owner decisions of 2026-09-26 during brainstorming (sub-project 2 after [player characters](player-character.md)). Implemented locally in MVP-18 on 2026-09-26 and checked natively in the development demo, see [main menu acceptance](../engineering/testing.md#main-menu-acceptance-mvp-18-2026-09-26). Pending: owner visual acceptance, VoiceOver (deferred by the owner), and final room and preset art. The intermittent wrong image on the iPhone 18 Pro was a React Native defect, fixed by a patch on 2026-09-27 and verified in a development build (see the acceptance record).

## Purpose

After sign-in the player needs one calm home screen. It shows who they play as and leads to the three things they do: work with Oaths in the Forge, learn the place with Żaromir and change settings. The menu replaces the temporary character badge in the Oath header. Pause and sign-out leave the Oath screens and move to Settings. The Forge room, earlier only in the development demo, is the real entrance to the Oath screens.

The Żaromir tutorial with its own content is a separate specification, see [tutorial](tutorial.md) (sub-project 3, proposed). Account deletion, data export and support belong to MVP-14.

## Flow

**Local decisions: owner instruction, 2026-09-26.**

Sign-in, onboarding and a first character come before the menu, as in [player characters](player-character.md). The menu is the home screen after that. Creating or switching a character returns to the menu, where the card already shows the new active character.

| From | Action | To |
| --- | --- | --- |
| Menu | Enter the Forge | Forge room. In simple layout, the Today list. |
| Menu | Tutorial | Forge room with the guide started from the first step |
| Menu | Settings | Settings |
| Menu | Change character | Change character, back returns to the menu |
| Forge room | Hearth | New Oath (current creation flow) |
| Forge room | Seals | Today list |
| Forge room | Chronicle | History list |
| Forge room | Moonlit door | Menu |
| Oath screens | Door "Return to the Forge" | Forge room. In simple layout, a plain "Back to menu" button returns to the menu. |
| Settings | Pause row | Pause review of the active character, back returns to Settings |
| Settings | Back | Menu |

Every route belongs to one account and one active character. A sign-out, an account change or a character change resets the route to the menu. The Oath screens stay mounted and hidden under the menu, the room and Settings, so their tab, drafts and handled room requests survive a return, as they already do under the change-character screen. The route belongs to the signed-in account, so a session check keeps it. The app checks the session again only after a return from the background, not after a short inactive moment such as a permission alert.

**Simple layout.** When the window is narrower than 350 pt or the text scale exceeds 1.3, the room is not interactive (the existing rule in the Oath screens). Then "Enter the Forge" opens the Today list directly, the Oath header and Oath creation show a plain "Back to menu" button instead of the door, and the Tutorial tile is hidden while Settings takes the full width.

**First visit.** The first entry into the room on a device starts the four-step guide automatically. The Tutorial tile starts it again at any time. The "seen" flag is local device storage per account, never sent to the server. Losing it only shows the guide again.

**Pending acceptance.** When the active character has an interrupted Oath acceptance, the Forge tile replaces its subtitle with "An Oath awaits confirmation". Entering the Forge then resumes that acceptance directly, like the current list does.

## Menu screen

Layout follows the accepted mockup, direction C "character card" v6 (390 × 844 pt, `.superpowers/brainstorm/67056-1790417325/content/menu-card-v6.html`). It keeps the [visual quality bar](../art/ui-system.md#visual-quality-bar).

- Background: the Forge room, blurred and darkened, with a vignette. Wordmark "OATHFORGE" at the top.
- Character card: full width inside 20 pt margins, radius 24, double gold hairline frame, warm under-light. The preset figure stands on the left. On the right are the name in serif, the form title in small caps, a gold rule, the stat and a "Change character" pill.
- Stat: a fire seal, the number and a label with plural forms (PL: 1 bieżąca Przysięga, 2 bieżące Przysięgi, 5 bieżących Przysiąg. EN: 1 current Oath, 2 current Oaths). While loading or after a failure the number shows "–", without blocking the menu. A paused character adds the line "Character paused".
- Tiles below the card, 12 pt gap: "Enter the Forge" full width, 190 pt, room art, glowing border and a round arrow button. "Tutorial" (Żaromir art) and "Settings" (forge tools art) half width, 176 pt. Radius 20, a single 1 px gold line.
- Large text: the card stacks the figure above the text and the tiles become full-width rows. The menu scrolls. Decorative words use `tokens.maxScale` limits so no word breaks inside.
- No XP, level or reward appears. None exists yet.

Copy (PL / EN):

| Element | Polish | English |
| --- | --- | --- |
| Forge tile | Wejdź do Kuźni · Palenisko, pieczęcie i kronika | Enter the Forge · Hearth, seals and chronicle |
| Tutorial tile | Samouczek · Żaromir wyjaśni zasady | Tutorial · Zharomir explains the rules |
| Settings tile | Ustawienia · Język, pauza, konto | Settings · Language, pause, account |
| Change character | Zmień postać | Change character |
| Pending acceptance | Przysięga czeka na potwierdzenie | An Oath awaits confirmation |
| Paused | Postać w pauzie | Character paused |

## Current Oaths

The stat counts the active character's Oaths in the Today view: scheduled, active, awaiting proof, needing more evidence and under review. The server owns the count.

`GET /api/oaths` gains a `total` field with the number of items in the requested view for the active character, after the same due-state reconciliation the list already performs. The menu reads `view=today&limit=1` and uses `total` and `paused`. It refreshes on every menu entry, on app foreground, after an Oath confirmation and after a pause change. There is no concurrent-Oath quota, so counting list pages on the client is not reliable.

## Settings

A full screen with a back button to the menu, on the same darkened room background.

| Row | Behavior |
| --- | --- |
| Language | Polish or English. The choice saves `locale` through `PATCH /api/profile` and applies after the server confirms. On failure the previous language stays and an error line appears. This makes the language choice persistent, replacing the session-only in-app choice. |
| Notifications | On or off, from `notificationPreference`. Turning on asks for iOS permission through the existing notification controller. When permission is denied the row explains it and offers "Open iOS Settings". No notification is scheduled yet. |
| Pause | Shows the active character's name and state (active or paused) and opens the existing pause review. The review confirms with its revision, as today. Pause applies only to that character. |
| Sign out | Signs out at once, as the current buttons do. |

## Forge room

The room lives in the app as `apps/mobile/src/forge/ForgeRoom.tsx` with `StationEffect.tsx`, moved from the demo with its behavior: full-screen room `room-prototype-v03`, Żaromir walking to the chosen place, contextual speech bubbles, the four-step guide, diffuse object lights and the moonlit door. Its copy is in the main PL/EN catalogs under `room`. Reduce Motion keeps the existing static equivalent. A speech bubble taller than the space under its place grows upward, never above the station touch areas, so its text and action stay visible on a 375 × 667 pt screen. The demo keeps its controls and scenarios and renders the app room.

The room art stays provisional, as recorded in the [stations prototype](../art/forge-stations-prototype.md). Moving it into the app does not accept it as final art.

## Artwork

- Menu background and Forge tile: crops of `room-prototype-v03` already in `apps/mobile/assets/forge/`.
- Tutorial tile: the canonical `zharomir-wanderer-v01` export.
- Settings tile: `settings-tools-v01`, a provisional crop of the hearth station export traced from the mockup file `tools.jpg`. Details and checksums are in the [menu asset manifest](../art/menu-assets.md).
- Card figure: the preset figure of the active character, currently DUMMY presets.

## Acceptance

- API integration tests: `total` for today and history, per character, after reconciliation, unchanged by pagination.
- Mobile tests: route reducer transitions and resets, simple layout routing, menu stat states and plurals, pending acceptance tile, Settings language save and failure, notification toggle, pause entry, sign-out, guide auto-start once per account.
- Native checks on iPhone SE 3 and iPhone 18 Pro in Polish and English, largest text and Reduce Motion, against the pixel-perfect bar. VoiceOver is deferred by owner decision, 2026-09-26.

## Out of scope

Żaromir tutorial content (sub-project 3), account deletion and data controls (MVP-14), scheduled notifications, XP and rewards on the menu, final room and preset artwork, Android.
