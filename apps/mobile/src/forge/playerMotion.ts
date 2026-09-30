import type { CharacterBuild } from '../api/characters';
import type { ArtSet } from '../art/registry';
import type { FigureSheets } from './motion';

/** The player's sprite sheets for a preset and build, or null while only the still menu figure exists. */
export function playerSheets(art: Pick<ArtSet, 'playerMotion'>, presetId: string, build: CharacterBuild): FigureSheets | null {
  const key = `${presetId}.${build}`;
  return Object.hasOwn(art.playerMotion, key) ? art.playerMotion[key] : null;
}
