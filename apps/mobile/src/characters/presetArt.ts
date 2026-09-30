import type { CharacterBuild } from '../api/characters';
import type { ArtSet, PresetArt } from '../art/registry';

export type { PresetArt };

// The owner's six starters, each drawn thin and heavy (docs/art/player-preset-assets.md). The files of each style are in src/art.
// A stored character may keep a preset the app cannot draw, callers show a neutral placeholder then.
export function presetArt(presets: ArtSet['presets'], id: string, build: CharacterBuild): PresetArt | null {
  const builds = Object.hasOwn(presets, id) ? presets[id] : null;
  return builds && Object.hasOwn(builds, build) ? builds[build] : null;
}
export function drawablePresets(presets: ArtSet['presets'], serverPresets: readonly string[]): string[] { return serverPresets.filter(id => Object.hasOwn(presets, id)); }
