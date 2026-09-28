import type { CharacterForm } from '../api/characters';
import { tutorialChapters, tutorialLineKeys, type TutorialPlace } from './tutorialChapters';

export type Speaker = 'player' | 'guide';
/** One line in the dialogue panel. step numbers Żaromir's tutorial lines, so "2 / 4" keeps its MVP-19 meaning. */
export type ScriptLine = { speaker: Speaker; key: string; values?: Record<string, unknown>; step?: { line: number; lines: number } };
/** After a place visit the panel offers that place's action. */
export type ScriptAction = { action: TutorialPlace };

type PlayerLine = 'hearth' | 'seals' | 'chronicle' | 'door' | 'tutorial.hearth' | 'tutorial.seals' | 'tutorial.chronicle' | 'tutorial.door';
// Polish past tense agrees with the character's form in these lines. The catalogs repeat the English text under each form.
const gendered: ReadonlySet<PlayerLine> = new Set(['tutorial.chronicle', 'tutorial.door']);

/** The catalog key of a player line in the character's form (docs/product/forge-scene.md "Player lines"). */
export const playerLineKey = (line: PlayerLine, form: CharacterForm) => gendered.has(line) ? `room.player.${line}.${form}` : `room.player.${line}`;

/** A place visit: the player speaks first, Żaromir describes the place, then its action shows. */
export function visitScript(place: 'hearth' | 'seals' | 'chronicle' | 'door', form: CharacterForm): (ScriptLine | ScriptAction)[] {
  return [{ speaker: 'player', key: playerLineKey(place, form) }, { speaker: 'guide', key: `room.descriptions.${place}` }, { action: place }];
}

/** A tutorial chapter: the player's question, then Żaromir's accepted chapter lines with their counter. */
export function chapterScript(place: TutorialPlace, form: CharacterForm): ScriptLine[] {
  const chapter = tutorialChapters.find(item => item.place === place)!;
  return [
    { speaker: 'player', key: playerLineKey(`tutorial.${place}`, form) },
    ...tutorialLineKeys(chapter).map((key, index) => ({ speaker: 'guide' as const, key, step: { line: index + 1, lines: chapter.lines } })),
  ];
}

/** A first-visit guide step: Żaromir alone. */
export const guideScript = (place: TutorialPlace): ScriptLine[] => [{ speaker: 'guide', key: `room.guide.${place}` }];
