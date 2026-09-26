import type { ImageSourcePropType } from 'react-native';

export type PresetArt = { figure: ImageSourcePropType; portrait: ImageSourcePropType; dummy: boolean };

// DUMMY crops from an exploration lineup, replaced by owner artwork (docs/art/player-preset-assets.md).
const art: Record<string, PresetArt> = {
  dummy_braid: { figure: require('../../assets/player/dummy-braid-figure-v01.png'), portrait: require('../../assets/player/dummy-braid-portrait-v01.png'), dummy: true },
  dummy_cropped: { figure: require('../../assets/player/dummy-cropped-figure-v01.png'), portrait: require('../../assets/player/dummy-cropped-portrait-v01.png'), dummy: true },
  dummy_curly: { figure: require('../../assets/player/dummy-curly-figure-v01.png'), portrait: require('../../assets/player/dummy-curly-portrait-v01.png'), dummy: true },
  dummy_tied: { figure: require('../../assets/player/dummy-tied-figure-v01.png'), portrait: require('../../assets/player/dummy-tied-portrait-v01.png'), dummy: true },
};

// A stored character may keep a preset the app cannot draw, callers show a neutral placeholder then.
export function presetArt(id: string): PresetArt | null { return Object.hasOwn(art, id) ? art[id] : null; }
export function drawablePresets(serverPresets: readonly string[]): string[] { return serverPresets.filter(id => presetArt(id) !== null); }
