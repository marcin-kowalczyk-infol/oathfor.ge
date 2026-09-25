# Player character and Forge roles

Status: product exploration requested by the owner on 2026-09-26. The avatar creator, naming and visual progression below are proposals, not approved MVP additions or implemented account fields. The existing [onboarding contract](onboarding.md), [first-loop rules](first-loop.md) and server-owned progression remain authoritative.

## Why a separate player character

Owner observation: Żaromir works as a helper and guide, but the main player has no visible identity. The current spatial prototype moves a provisional Żaromir sprite. That demonstrates walking and station interaction, not a selected player avatar.

Agent opinion: the player should own the central character. Żaromir should be a distinct companion who introduces places, explains consequences and reacts to the player's choices. He should remain recognizable in his portrait and speech bubbles. Moving only Żaromir makes it unclear whose journey this is and leaves personal progression without a visible subject.

Proposed staging: show the player near the entrance, with Żaromir beside the hearth or appearing when guidance is needed. Selecting a place moves the player there. Żaromir may turn toward the player or speak, but should not perform the player's commitment. Only an explicit rule confirmation creates an Oath.

## First appearance and customization

Owner direction for exploration: people should be able to build a character and choose gender presentation and appearance. The starting character should look ordinary and inexperienced, with a simple everyday silhouette. Record this as a visual starting point, not a judgment about the person's real fitness, body or worth.

Agent proposal: plain linen or wool clothing, worn boots, modest equipment and an unadorned belt. No starting heroic armor, trophies or magical aura. Keep the figure appealing and dignified. Later cosmetic layers could make the journey visible without replacing facial identity or making body transformation a requirement.

For a first prototype, offer a few coherent presets with optional hair, skin tone and presentation choices. Do not make the user finish a complex editor before seeing the Forge. A single full-screen character selection with a clear continue action could precede the current journey. Detailed customization could be revisited later. These are proposed experience choices, not persistence or entitlement decisions.

## Naming candidates

| Candidate | Assessment |
| --- | --- |
| Twoja postać / Your character | Recommended interface wording for now. Clear and easy to understand. |
| Przysiężnik / Oathbearer | Proposed role title for exploration. Fits the commitment theme, but needs owner and PL/EN copy review. Not a historical authenticity claim. |
| Oathtar | Owner's working idea. Distinctive, but its pronunciation and connection to the Slavic direction are less clear. Keep in the idea list, not the current interface. |

Agent recommendation: separate a simple interface term from the eventual lore title. The user chooses a character, then learns who that character is in this world. Do not invent a new noun merely to replace the familiar word avatar.

## Forge interaction map

Local implementation direction from the same feedback:

| Place | Purpose | Feedback | Boundary |
| --- | --- | --- | --- |
| Hearth | Choose and prepare a new Oath | A short fire burst and a modest camera approach on room entry | Opens creation or recovery of a pending confirmation. Never commits by tapping the fire. |
| Seals | Inspect current commitments and cases | A short turning motion | Opens the current list. Each item opens its authoritative detail. |
| Chronicle | Revisit past outcomes | A page-turn motion | Opens history. It does not duplicate creation as its primary purpose. |
| Door or return control | Leave a panel and return to the room | Clear door imagery | Preserves form choices and unresolved acceptance. It does not sign out. |

Station animation is immediate feedback. A short companion bubble names the purpose and exposes the destination action. Motion must not determine whether an Oath exists. Reduced motion uses the same choices with static feedback. Rapid place changes cannot open an obsolete destination.

## Before an avatar feature is implemented

Decide the first preset range, PL/EN naming, whether selection precedes or follows account setup, and the later editing policy. Prepare distinct player and companion references and inspect their silhouettes together. Define server-owned profile persistence, retry behavior and cosmetic entitlement rules in a separate bounded task. An interrupted selection must not mark onboarding complete or grant XP. Existing accounts need a deliberate default or an optional invitation to select a character.

Observable prototype acceptance: the owner can identify the player and Żaromir without reading labels, can see who is speaking, can select a starter look without earning progression, and can identify which Forge object opens creation, current Oaths or history. No avatar creator is delivered by the current visual-polish continuation.
