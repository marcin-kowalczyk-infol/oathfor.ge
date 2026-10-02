import { Easing } from 'react-native';
import type { Direction } from './motion';

/** The room artwork in pixels. Every position below is a fraction of it. */
export const ARTWORK = { width: 887, height: 1774 };
export type Spot = { x: number; y: number };
export type ScenePlace = 'hearth' | 'seals' | 'chronicle' | 'door';
export const scenePlaces: readonly ScenePlace[] = ['hearth', 'seals', 'chronicle', 'door'];

/**
 * Each place has its object anchor (touch area and glow), where the player stands to handle it and where Żaromir stands to explain it.
 * Local decision (MVP-20 planning): the pilot hearth pose faces upper left, so the player stands right of the fire.
 * Żaromir's door spot is in front of the seal pedestals, because a point on them (0.31, 0.56) stood him on the seals.
 */
export const places: Record<ScenePlace, { anchor: Spot; player: Spot; guide: Spot }> = {
  hearth: { anchor: { x: 0.515, y: 0.45 }, player: { x: 0.54, y: 0.565 }, guide: { x: 0.40, y: 0.575 } },
  seals: { anchor: { x: 0.22, y: 0.52 }, player: { x: 0.30, y: 0.635 }, guide: { x: 0.42, y: 0.665 } },
  chronicle: { anchor: { x: 0.82, y: 0.51 }, player: { x: 0.78, y: 0.66 }, guide: { x: 0.62, y: 0.66 } },
  door: { anchor: { x: 0.17, y: 0.37 }, player: { x: 0.19, y: 0.50 }, guide: { x: 0.36, y: 0.60 } },
};
/** The player's start point in the lower middle of the room, above the dialogue panel (native check, MVP-20-T15). */
export const playerStart: Spot = { x: 0.63, y: 0.74 };
/** Żaromir in normal mode, near the anvil right of the hearth. */
export const aside: Spot = { x: 0.66, y: 0.545 };
/** Żaromir while the player chooses a tutorial chapter, in front of the hearth (MVP-19). */
export const tutor: Spot = { x: 0.5, y: 0.66 };

/**
 * The DUMMY shade over an unlit station (engagement.md E2 "Fallback"), centre and size as fractions of the artwork.
 * Native check on iPhone 18 Pro (E2.2 follow-up): a shade on the anchor alone left the chronicle lectern looking lit.
 * Each box spans its whole station with a margin, because the shade fades toward its corners. The seal box ends before the hearth.
 */
export const unlitShades: Record<'seals' | 'chronicle', Spot & { width: number; height: number }> = {
  seals: { x: 0.205, y: 0.546, width: 0.46, height: 0.15 },
  chronicle: { x: 0.83, y: 0.546, width: 0.3, height: 0.165 },
};

/** Below this depth the feet are in front of the seal drums, so the cut no longer covers the figure. */
export const SEALS_FRONT_Y = 957 / 1774;

// Sprite cells are 288 × 320 with the soles at 97.5 percent. 105 points keep Żaromir's figure at the former 93 points.
export const FIGURE_HEIGHT = 105;
export const FIGURE_WIDTH = FIGURE_HEIGHT * 288 / 320;
export const FIGURE_FOOT = 312 / 320;

/** A gentle start and stop around a steady pace, so the steps do not slide. HeroSprite uses the same curve for depth. */
export const walkPace = Easing.bezier(0.3, 0, 0.7, 1);
/** Deeper into the room a figure is drawn a little smaller: full size at the start point, 86 percent near the back wall. */
export const depth = (y: number) => 0.86 + 0.14 * Math.min(1, Math.max(0, (y - 0.45) / (0.82 - 0.45)));

/** The artwork's cover transform in a window, shared by the image and every anchor. */
export function cover(window: { width: number; height: number }) {
  const scale = Math.max(window.width / ARTWORK.width, window.height / ARTWORK.height);
  const width = scale * ARTWORK.width;
  const height = scale * ARTWORK.height;
  return { width, height, left: (window.width - width) / 2, top: (window.height - height) / 2 };
}

/**
 * The body of a figure standing at a spot, in window points: half the drawn cell width and 92 percent of its height above the feet.
 * Local decision (MVP-20 planning): two figures at rest must never have intersecting bodies.
 */
export function bodyBox(spot: Spot, window: { width: number; height: number }) {
  const scene = cover(window);
  const x = scene.left + spot.x * scene.width;
  const y = scene.top + spot.y * scene.height;
  const height = FIGURE_HEIGHT * depth(spot.y);
  const width = height * 288 / 320;
  return { left: x - width / 4, right: x + width / 4, top: y - height * 0.92, bottom: y };
}

// Counter-clockwise from the right, in 45 degree sectors of the artwork plane.
const compass: Direction[] = ['right', 'back-right', 'back', 'back-left', 'left', 'front-left', 'front', 'front-right'];
const artwork = (from: Spot, to: Spot) => ({ dx: (to.x - from.x) * ARTWORK.width, up: (from.y - to.y) * ARTWORK.height });
/** Travel direction in artwork pixels, one of eight sheets. Sprites are never mirrored, so the lantern stays in his right hand. */
export function walkDirection(from: Spot, to: Spot): Direction {
  const { dx, up } = artwork(from, to);
  const sector = Math.round(Math.atan2(up, dx) / (Math.PI / 4));
  return compass[(sector + 8) % 8];
}
/** Walk time grows with the distance in artwork pixels, so the steps roughly match the ground covered. */
export function walkDuration(from: Spot, to: Spot) {
  const { dx, up } = artwork(from, to);
  return Math.round(Math.min(1800, Math.max(600, Math.hypot(dx, up) * 3.3)));
}

// The seal pedestals as a floor box in artwork fractions (feet between y 0.54 and 0.59 left of x 0.36 stand on them).
const PEDESTALS = { left: 0.02, right: 0.36, top: 0.54, bottom: 0.59 };
/** Between the right end of the pedestals and the hearth steps. Native check on iPhone 18 Pro (MVP-20-T15). */
export const PEDESTAL_WAYPOINT: Spot = { x: 0.43, y: 0.545 };
const onPedestals = (spot: Spot) => spot.x > PEDESTALS.left && spot.x < PEDESTALS.right && spot.y > PEDESTALS.top && spot.y < PEDESTALS.bottom;
const crossesPedestals = (from: Spot, to: Spot) => Array.from({ length: 41 }, (_, step) => step / 40)
  .some(t => onPedestals({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }));
/** The legs of a walk: straight, or around the right end of the seal pedestals when the straight line would cross them. */
export function route(from: Spot, to: Spot): Spot[] {
  return crossesPedestals(from, to) ? [PEDESTAL_WAYPOINT, to] : [to];
}
