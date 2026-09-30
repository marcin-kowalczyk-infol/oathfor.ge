/**
 * Sheet metadata for the Forge motion art. The sheets of each art style are listed in src/art (current.ts, cinematic.ts).
 * The v01 sheets were exported by graphics/forge-motion/export-motion-v01.py.
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

export const sheet = (source: number, cols: number, rows: number, cell: [number, number], anchor: [number, number], blend: Sheet['blend']): Sheet =>
  ({ source, cols, rows, aspect: cell[0] / cell[1], anchor: { x: anchor[0], y: anchor[1] }, blend });
/** A character sheet: cells 288 × 320, torso centred, soles at 312. Used by Żaromir and the player sprites. */
export const hero = (source: number, cols: number) => sheet(source, cols, 2, [288, 320], [0.5, 312 / 320], 'normal');

export type Direction = 'back' | 'back-left' | 'back-right' | 'front' | 'front-left' | 'front-right' | 'left' | 'right';
export type HeroPlace = 'hearth' | 'seals' | 'chronicle' | 'door';

/** A figure's sheets. Turning and talking are Żaromir's only, other figures fall back to breathing. */
export type FigureSheets = { walk: Record<Direction, Sheet>; idle: Sheet; act: Record<HeroPlace, Sheet>; turn?: Sheet; talk?: Sheet };

export const frameCount = (value: Sheet) => value.cols * value.rows;
