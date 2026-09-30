import type { ImageSourcePropType } from 'react-native';
import type { CharacterBuild } from '../api/characters';
import type { AppearanceId } from '../companion/catalog';
import type { FigureSheets, Sheet } from '../forge/motion';

/**
 * The art styles. current is the v01 set. cinematic is the restyle direction (docs/art/cinematic-assets.md),
 * where every file without a cinematic export falls back to its current version.
 */
export type ArtStyle = 'current' | 'cinematic';
export const ART_STYLES: readonly ArtStyle[] = ['current', 'cinematic'];

/** An injected style choice. Only the demo supplies one, so production always draws the current style. */
export type ArtStyleStorage = { read(): ArtStyle; write(style: ArtStyle): void };

/** A box on the room artwork in its pixels: x, y, width, height. */
export type Box = readonly [number, number, number, number];
/** A painted flame: base centre and core width, as fractions of the room artwork. */
export type Candle = { x: number; y: number; core: number };

/**
 * The room artwork (887 × 1774) with everything cut from or measured on it.
 * Cut layers repeat the painted room, so a room without its own cuts has none. Old cuts are never drawn over a new room.
 */
export type RoomArt = {
  image: number;
  candles: readonly Candle[];
  /** Covers a figure that walks behind the seal drums. */
  sealsFront: { source: number; box: Box } | null;
  doorLeaf: { source: number; box: Box; hinge: number } | null;
  /** The drums that turn at the seals, with each turning centre. */
  seals: Record<'star' | 'tree' | 'wolf', { source: number; box: Box; centre: readonly [number, number] }> | null;
  /** The leaf that turns over the painted lectern book: its anchor in artwork pixels and its cell width as a fraction of the artwork. */
  bookPageTurn: { sheet: Sheet; x: number; y: number; width: number } | null;
};

/**
 * Where one companion picture sits in each frame, in points. The values follow the figure's size inside its canvas,
 * so each style keeps Żaromir the same size on screen.
 */
export type CompanionFrames = {
  /** The 44 pt round avatar of CompanionBubble, and the colour behind the picture. */
  bubble: { width: number; height: number; left: number; top: number; backdrop: string };
  /** The menu Tutorial tile. left applies beside the Settings tile, right when the tiles are stacked. */
  tile: { width: number; height: number; top: number; left: number; right: number };
  /** The 180 × 270 panel of the introduction and the companion progress. */
  panel: { width: number; height: number; left: number; top: number };
};

export type PresetArt = { figure: ImageSourcePropType; portrait: ImageSourcePropType };
type Station = 'hearth' | 'seals' | 'chronicle';

export type ArtSet = {
  room: RoomArt;
  /** Station close-ups behind the Oath screens. */
  stations: Record<Station, number>;
  /** The looping flame on the hearth close-up: base centre and sprite width, as fractions of the close-up width and height. */
  stationFire: { x: number; y: number; width: number };
  haze: number;
  activityObjects: number;
  stateSeals: number;
  menuTools: number;
  companion: Record<AppearanceId, { image: number; frames: CompanionFrames }>;
  zharomir: Required<FigureSheets>;
  zharomirBust: number;
  effects: Record<'hearthLoop' | 'hearthBurst' | 'doorMist' | 'candle' | 'wisp' | 'sealStar' | 'sealTree' | 'sealWolf' | 'bookSigns', Sheet>;
  panel: Record<'corner' | 'edgeH' | 'edgeV' | 'fill' | 'plate' | 'rune', number>;
  talk: Record<'oaths' | 'chronicle', number>;
  oaths: { hourglass: Sheet; hourglassStill: number; ruleIcons: Sheet; sealStamp: Sheet; sealSparks: Sheet };
  presets: Record<string, Record<CharacterBuild, PresetArt>>;
  /** Player sprite sheets by `${presetId}.${build}`. */
  playerMotion: Record<string, FigureSheets>;
};

/**
 * A style's own files. Each entry replaces the current one of the same name.
 * The room and a figure's sheets are whole units: their parts are measured on one artwork or share one cell layout.
 */
export type ArtOverrides = Partial<Pick<ArtSet, 'room' | 'zharomir' | 'haze' | 'activityObjects' | 'stateSeals' | 'menuTools' | 'zharomirBust' | 'stationFire'>> & {
  companion?: Partial<ArtSet['companion']>;
  stations?: Partial<ArtSet['stations']>;
  effects?: Partial<ArtSet['effects']>;
  panel?: Partial<ArtSet['panel']>;
  talk?: Partial<ArtSet['talk']>;
  oaths?: Partial<ArtSet['oaths']>;
  presets?: Record<string, Partial<Record<CharacterBuild, PresetArt>>>;
  playerMotion?: Record<string, FigureSheets>;
};

const merge = <T extends object>(base: T, own: Partial<T> | undefined): T => ({ ...base, ...own });

/** The art of a style. A missing file falls back to its current version. */
export function mergeArt(base: ArtSet, own: ArtOverrides): ArtSet {
  const presets = { ...base.presets };
  for (const [id, builds] of Object.entries(own.presets ?? {})) presets[id] = { ...presets[id], ...builds } as ArtSet['presets'][string];
  return {
    room: own.room ?? base.room,
    stations: merge(base.stations, own.stations),
    stationFire: own.stationFire ?? base.stationFire,
    haze: own.haze ?? base.haze,
    activityObjects: own.activityObjects ?? base.activityObjects,
    stateSeals: own.stateSeals ?? base.stateSeals,
    menuTools: own.menuTools ?? base.menuTools,
    companion: merge(base.companion, own.companion),
    zharomir: own.zharomir ?? base.zharomir,
    zharomirBust: own.zharomirBust ?? base.zharomirBust,
    effects: merge(base.effects, own.effects),
    panel: merge(base.panel, own.panel),
    talk: merge(base.talk, own.talk),
    oaths: merge(base.oaths, own.oaths),
    presets,
    playerMotion: merge(base.playerMotion, own.playerMotion),
  };
}
