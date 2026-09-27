# Player characters

Status: accepted specification, owner decisions of 2026-09-26 during brainstorming. Implemented locally in MVP-17 on 2026-09-26 with four DUMMY presets. Owner preset artwork, owner visual acceptance and VoiceOver remain pending. Delivery epic: MVP-17 in the local backlog. Architectural decision: [ADR 0005](../decisions/0005-character-owned-oaths.md).

## Purpose

The player needs a visible identity of their own. Żaromir stays a separate companion who guides and reacts. An account can hold several characters, like save slots. Each character has its own Oaths, history and pause. The character is created once and then kept. A later main menu shows the active character on its first screen.

This specification covers the character itself. The main menu, Settings and the Forge room are specified in [main menu](main-menu.md). The tutorial is a later, separate specification.

## Rules

**Local decisions: owner instruction, 2026-09-26.**

| Topic | Rule |
| --- | --- |
| Count | An account holds up to 3 characters. The first one is required. Characters cannot be deleted in MVP. |
| Look | The player picks one preset. A preset is a complete illustration set, not layered parts. The server owns the list of valid preset IDs. |
| Name | 2 to 20 characters after trimming and NFC normalization. Unicode letters, with a single space, hyphen or apostrophe allowed between letters. No uniqueness and no word filter in MVP. Only the player sees the name. |
| Polish form | Masculine, feminine or neutral. Chosen at creation, independent of the preset look. |
| Title | PL: Obrońca Przysięgi, Obrończyni Przysięgi, Straż Przysięgi. EN: Oathkeeper. |
| Editing | A created character cannot be changed. "Change character" switches the active character or creates a new one while below the limit. |
| Ownership | Every Oath belongs to exactly one character. Lists, detail, previews, acceptance and pause apply to one character. |
| Pause | Pause belongs to a character. It withdraws only that character's current Oaths. |
| Order | Sign-in, onboarding, then a first character, then the Oath screens. No Oath exists without a character. |

Creating or switching characters grants no XP, reward or unlock. Only explicit rule acceptance creates an Oath, as before.

## First run and switching

After onboarding completes, an account without an active character sees full-screen character creation. The same rule applies to every account, so no separate invitation path exists. If an Oath endpoint reports `character_required`, the app returns to character creation.

Creation shows a large illustration of the selected preset, a row of preset portraits, the name field with live validation, and three form choices showing their title. "Create character" submits once. Leaving or losing the connection keeps the draft and creates nothing. A lost reply is retried with the same request identity, so it can never create a duplicate.

"Change character" lists up to three character cards with the active one marked, plus a "New character" slot while below the limit. Choosing a card makes it active and reloads that character's Oaths. The entry is the "Change character" pill on the character card of the [main menu](main-menu.md). Back returns to the menu.

A pending acceptance belongs to the character of its preview. Switching characters never completes or discards it. It becomes visible again when that character is active.

## Server behavior

- A `player_character` record holds identity, account, name, preset, form, pause state with its revision, and creation time. The account stores its active character.
- `GET /api/characters` returns the characters and the active ID. `POST /api/characters` creates and activates a character, idempotent by client request ID. `PUT /api/characters/active` switches. Another account's character is not found.
- The limit is enforced under the account row lock, the same serialization used by profile and Oath writes.
- Oath list, detail and pause use the account's active character. A preview records its character. Acceptance creates the Oath for the preview's character even if the active character changed meanwhile.
- Without an active character, Oath endpoints answer `409 character_required`.
- No production data exists. The migration removes local test Oaths instead of assigning them.

Exact request and response shapes are recorded in the [API contract](../engineering/api-contract.md) when implemented.

## Mobile behavior

- A strict client validates character responses like the profile client.
- A character controller serializes creation and switching. It stores the creation request ID before sending.
- The Oath controller binds to account and character. A switch invalidates its in-flight requests and reloads lists, like a session change.
- Pending acceptance storage is keyed by account and character.
- Polish copy addressed to the player can select masculine, feminine or neutral variants. In this epic only the title uses them.

## Artwork

The owner supplies 6 to 8 presets, each as a full figure and a portrait, varying presentation, skin tone, hair and everyday body type. Starting presets are poorly dressed, in patched and worn clothing, with ordinary untrained bodies and no visible musculature. The character is meant to progress and change appearance over time, so the presets are its first stage and keep a simple, easily preserved identity. How the player character progresses is not yet specified. **Local decision: owner instruction, 2026-09-27.** Until then, the four figures from `player-starters-lineup-v01` are DUMMY presets, labelled in the manifest and never shipped as final. Presets follow the [art pipeline](../art/pipeline.md) and the [visual quality bar](../art/ui-system.md#visual-quality-bar).

## Acceptance

- API integration tests: creation, identical retry, limit, invalid name and preset codes, foreign character, switch, `character_required`, preview bound to character, acceptance after switch, per-character lists and pause.
- Mobile tests: response validation, lost-reply retry, routing to creation, switch invalidation, pending acceptance per character, name validation.
- Native checks on iPhone SE 3 and iPhone 18 Pro in Polish and English, maximum text and Reduce Motion. VoiceOver is deferred by owner decision, 2026-09-26.

## Out of scope

Main menu, Settings, Forge room in the app, tutorial, character deletion, name moderation, XP and rewards, sharing characters with squads.
