import type { ImageSourcePropType } from 'react-native';
import type { CharacterBuild } from '../api/characters';

export type PresetArt = { figure: ImageSourcePropType; portrait: ImageSourcePropType };

// The owner's six starters, each drawn thin and heavy (docs/art/player-preset-assets.md). Metro needs every require spelled out.
const art: Record<string, Record<CharacterBuild, PresetArt>> = {
  starter_01: {
    thin: { figure: require('../../assets/player/starter-01-thin-figure-v01.png'), portrait: require('../../assets/player/starter-01-thin-portrait-v01.png') },
    heavy: { figure: require('../../assets/player/starter-01-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-01-heavy-portrait-v01.png') },
  },
  starter_02: {
    thin: { figure: require('../../assets/player/starter-02-thin-figure-v01.png'), portrait: require('../../assets/player/starter-02-thin-portrait-v01.png') },
    heavy: { figure: require('../../assets/player/starter-02-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-02-heavy-portrait-v01.png') },
  },
  starter_03: {
    thin: { figure: require('../../assets/player/starter-03-thin-figure-v01.png'), portrait: require('../../assets/player/starter-03-thin-portrait-v01.png') },
    heavy: { figure: require('../../assets/player/starter-03-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-03-heavy-portrait-v01.png') },
  },
  starter_04: {
    thin: { figure: require('../../assets/player/starter-04-thin-figure-v01.png'), portrait: require('../../assets/player/starter-04-thin-portrait-v01.png') },
    heavy: { figure: require('../../assets/player/starter-04-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-04-heavy-portrait-v01.png') },
  },
  starter_05: {
    thin: { figure: require('../../assets/player/starter-05-thin-figure-v01.png'), portrait: require('../../assets/player/starter-05-thin-portrait-v01.png') },
    heavy: { figure: require('../../assets/player/starter-05-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-05-heavy-portrait-v01.png') },
  },
  starter_06: {
    thin: { figure: require('../../assets/player/starter-06-thin-figure-v01.png'), portrait: require('../../assets/player/starter-06-thin-portrait-v01.png') },
    heavy: { figure: require('../../assets/player/starter-06-heavy-figure-v01.png'), portrait: require('../../assets/player/starter-06-heavy-portrait-v01.png') },
  },
};

// A stored character may keep a preset the app cannot draw, callers show a neutral placeholder then.
export function presetArt(id: string, build: CharacterBuild): PresetArt | null {
  const builds = Object.hasOwn(art, id) ? art[id] : null;
  return builds && Object.hasOwn(builds, build) ? builds[build] : null;
}
export function drawablePresets(serverPresets: readonly string[]): string[] { return serverPresets.filter(id => Object.hasOwn(art, id)); }
