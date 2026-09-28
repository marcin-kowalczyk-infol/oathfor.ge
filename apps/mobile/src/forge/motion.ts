/**
 * Forge motion sheets, exported by graphics/forge-motion/export-motion-v01.py.
 * Frames are row-major. Character cells are 288 × 320 with the torso centred and the soles at 97.5 percent.
 * Light sheets are drawn on black for a screen blend, so black disappears over the room.
 */
export type Sheet = {
  source: number; cols: number; rows: number;
  /** Cell width divided by cell height. */
  aspect: number;
  /** Anchor inside a cell, as fractions of its width and height. */
  anchor: { x: number; y: number };
  blend: 'screen' | 'normal';
};

const sheet = (source: number, cols: number, rows: number, cell: [number, number], anchor: [number, number], blend: Sheet['blend']): Sheet =>
  ({ source, cols, rows, aspect: cell[0] / cell[1], anchor: { x: anchor[0], y: anchor[1] }, blend });
/** A character sheet: cells 288 × 320, torso centred, soles at 312. Used by Żaromir and the player sprites. */
export const hero = (source: number, cols: number) => sheet(source, cols, 2, [288, 320], [0.5, 312 / 320], 'normal');

export type Direction = 'back' | 'back-left' | 'back-right' | 'front' | 'front-left' | 'front-right' | 'left' | 'right';
export type HeroPlace = 'hearth' | 'seals' | 'chronicle' | 'door';

/** A figure's sheets. Turning and talking are Żaromir's only, other figures fall back to breathing. */
export type FigureSheets = { walk: Record<Direction, Sheet>; idle: Sheet; act: Record<HeroPlace, Sheet>; turn?: Sheet; talk?: Sheet };

export const heroSheets = {
  walk: {
    back: hero(require('../../assets/forge/motion/zharomir-walk-back-v02.png'), 4),
    'back-left': hero(require('../../assets/forge/motion/zharomir-walk-back-left-v01.png'), 4),
    'back-right': hero(require('../../assets/forge/motion/zharomir-walk-back-right-v01.png'), 4),
    front: hero(require('../../assets/forge/motion/zharomir-walk-front-v01.png'), 4),
    'front-left': hero(require('../../assets/forge/motion/zharomir-walk-front-left-v01.png'), 4),
    'front-right': hero(require('../../assets/forge/motion/zharomir-walk-front-right-v01.png'), 4),
    left: hero(require('../../assets/forge/motion/zharomir-walk-left-v02.png'), 4),
    right: hero(require('../../assets/forge/motion/zharomir-walk-right-v02.png'), 4),
  } satisfies Record<Direction, Sheet>,
  idle: hero(require('../../assets/forge/motion/zharomir-idle-v02.png'), 4),
  // Gestures: explain, point left, point right, nod.
  talk: hero(require('../../assets/forge/motion/zharomir-talk-v01.png'), 2),
  // Back view to the player-facing three-quarter view.
  turn: hero(require('../../assets/forge/motion/zharomir-turn-v01.png'), 2),
  // Each pose faces its place: back view at the hearth and the door, back three-quarter at the seals and the chronicle.
  act: {
    hearth: hero(require('../../assets/forge/motion/zharomir-act-hearth-v01.png'), 2),
    seals: hero(require('../../assets/forge/motion/zharomir-act-seals-v01.png'), 2),
    chronicle: hero(require('../../assets/forge/motion/zharomir-act-chronicle-v01.png'), 2),
    door: hero(require('../../assets/forge/motion/zharomir-act-door-v01.png'), 2),
  } satisfies Record<HeroPlace, Sheet>,
};

export const effectSheets = {
  hearthLoop: sheet(require('../../assets/forge/motion/fx-hearth-loop-v01.png'), 4, 2, [288, 384], [0.5, 0.94], 'screen'),
  hearthBurst: sheet(require('../../assets/forge/motion/fx-hearth-burst-v01.png'), 4, 2, [288, 384], [0.5, 0.94], 'screen'),
  sealGlow: sheet(require('../../assets/forge/motion/fx-seal-glow-v01.png'), 4, 2, [192, 256], [0.5, 0.53], 'screen'),
  doorMist: sheet(require('../../assets/forge/motion/fx-door-mist-v01.png'), 4, 2, [192, 256], [0.5, 0.94], 'screen'),
  candle: sheet(require('../../assets/forge/motion/fx-candle-loop-v01.png'), 4, 2, [96, 128], [0.5, 0.94], 'screen'),
  wisp: sheet(require('../../assets/forge/motion/fx-attract-wisp-v01.png'), 4, 2, [96, 128], [0.5, 0.55], 'screen'),
  chroniclePage: sheet(require('../../assets/forge/motion/fx-chronicle-page-v01.png'), 4, 2, [192, 256], [0.5, 0.87], 'normal'),
  // MVP-20 scene responses (docs/art/forge-scene-assets.md).
  sealStar: sheet(require('../../assets/forge/scene/fx-seal-star-v01.png'), 4, 2, [192, 256], [0.5, 0.4], 'screen'),
  sealTree: sheet(require('../../assets/forge/scene/fx-seal-tree-v01.png'), 4, 2, [192, 256], [0.5, 0.4], 'screen'),
  sealWolf: sheet(require('../../assets/forge/scene/fx-seal-wolf-v01.png'), 4, 2, [192, 256], [0.5, 0.4], 'screen'),
  bookSigns: sheet(require('../../assets/forge/scene/fx-book-signs-v01.png'), 4, 2, [288, 384], [0.5, 0.94], 'screen'),
  bookFlutter: sheet(require('../../assets/forge/scene/fx-book-flutter-v01.png'), 4, 2, [256, 256], [0.5, 0.8063], 'normal'),
};

export const frameCount = (value: Sheet) => value.cols * value.rows;
