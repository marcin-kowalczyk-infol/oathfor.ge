import { useEffect, useRef, useState } from 'react';
import { Easing, StyleSheet, View } from 'react-native';
import { SpriteFrame } from './Sprite';
import { useArt } from '../art/ArtProvider';
import type { Direction, FigureSheets, HeroPlace, Sheet } from './motion';

export const WALK_FRAME_MS = 90;
const IDLE_FRAME_MS = 300;
const ACT_FRAME_MS = 260;
export const TURN_FRAME_MS = 110;
export const TALK_GESTURE_MS = 1100;
/** One full station action plays before Żaromir turns to the player to talk. */
export const ACT_BEFORE_TURN_MS = ACT_FRAME_MS * 4;

export type HeroPose =
  | { kind: 'walk'; direction: Direction }
  | { kind: 'idle' }
  | { kind: 'act'; place: HeroPlace }
  | { kind: 'turn' }
  /** Talk sheet frames to cycle: 0 explain, 1 point left, 2 point right, 3 nod. */
  | { kind: 'talk'; gestures: readonly number[] };

// The export normalised every walk frame to one height. A small bob restores the step: contact, down, passing, up.
const bob = [0, 1, -1, -2, 0, 1, -1, -2];

const timing = (pose: HeroPose, sheets: FigureSheets, name: string) => {
  const idle = { sheet: sheets.idle, frames: [0, 1, 2, 3, 4, 5, 6, 7], ms: IDLE_FRAME_MS, loop: true, id: `${name}-idle` };
  switch (pose.kind) {
    case 'walk': return { sheet: sheets.walk[pose.direction], frames: [0, 1, 2, 3, 4, 5, 6, 7], ms: WALK_FRAME_MS, loop: true, id: `${name}-walk-${pose.direction}` };
    case 'idle': return idle;
    case 'act': return { sheet: sheets.act[pose.place], frames: [0, 1, 2, 3], ms: ACT_FRAME_MS, loop: true, id: `${name}-pose-${pose.place}` };
    // A figure without turning or talking sheets breathes instead.
    case 'turn': return sheets.turn ? { sheet: sheets.turn, frames: [0, 1, 2, 3], ms: TURN_FRAME_MS, loop: false, id: `${name}-turn` } : idle;
    case 'talk': return sheets.talk ? { sheet: sheets.talk, frames: [...pose.gestures], ms: TALK_GESTURE_MS, loop: true, id: `${name}-talk` } : idle;
  }
};

/** Same curve as the room's walk movement, so the size follows his position. */
const pace = Easing.bezier(0.3, 0, 0.7, 1);

/**
 * Żaromir's current frame. A new pose or run restarts its sequence. Reduced motion holds the first frame.
 * scale is his depth in the room: a fixed number at rest, or from and to over a walk. Native check: a transform scale
 * blurred the sprite on iOS, so depth changes the drawn size, updated with each step, anchored at his feet.
 */
export function HeroSprite({ pose, allowed, height, scale = 1, run = 0, sheets: given, name = 'hero' }: {
  pose: HeroPose; allowed: boolean; height: number; scale?: number | { from: number; to: number; duration: number };
  /** Another figure's sheets and test name, for example the player's. Żaromir's by default. */
  sheets?: FigureSheets; name?: string;
  /** A new run restarts the frame timer and the depth change, for example each new walk. */
  run?: number;
}) {
  const art = useArt();
  const sheets = given ?? art.zharomir;
  const started = useRef({ run, at: Date.now() });
  if (started.current.run !== run) started.current = { run, at: Date.now() };
  const { sheet, frames, ms, loop, id } = timing(pose, sheets, name);
  const [step, setStep] = useState(0);
  const key = `${id}-${frames.join()}-${run}`;
  // A new pose or run starts at its first frame on its first render, not one render later.
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) { setLastKey(key); setStep(0); }
  // Native check: a new sheet loads asynchronously and the first frame was empty. The last shown frame stays underneath until it loads.
  type Shown = { sheet: typeof sheet; index: number; drawn: number };
  const shown = useRef<Shown | null>(null);
  const [under, setUnder] = useState<Shown | null>(null);
  const [lastSheet, setLastSheet] = useState(sheet);
  // A sheet still drawn underneath is already loaded and will not report it again, so it shows at once.
  if (lastSheet !== sheet) { setLastSheet(sheet); setUnder(under?.sheet === sheet ? null : shown.current); }
  // A sheet that never reports loading must not hide him for long.
  useEffect(() => {
    if (!under) return;
    const fallback = setTimeout(() => setUnder(null), 300);
    return () => clearTimeout(fallback);
  }, [under]);
  useEffect(() => {
    if (!allowed || frames.length < 2) return;
    let current = 0;
    const ticks = setInterval(() => {
      current = loop ? (current + 1) % frames.length : current + 1;
      setStep(current);
      if (!loop && current >= frames.length - 1) clearInterval(ticks);
    }, ms);
    return () => clearInterval(ticks);
  }, [allowed, key]);
  const index = frames[Math.min(step, frames.length - 1)];
  const depth = typeof scale === 'number' ? scale
    : scale.from + (scale.to - scale.from) * pace(Math.min(1, (Date.now() - started.current.at) / scale.duration));
  const drawn = height * depth;
  const lift = pose.kind === 'walk' && allowed ? bob[index] * drawn / 100 : 0;
  useEffect(() => { shown.current = { sheet, index, drawn }; });
  const box = height * sheet.aspect;
  // Each sheet keeps its own element, so the previous frame stays the image that is already loaded and never reloads.
  const previous = under && under.sheet !== sheet ? under : null;
  const layers = [
    ...(previous ? [<SpriteFrame key={sheetKey(previous.sheet)} sheet={previous.sheet} index={previous.index} height={previous.drawn} testID="hero-previous"
      style={{ position: 'absolute', bottom: 0, left: (box - previous.drawn * previous.sheet.aspect) / 2 }} />] : []),
    <SpriteFrame key={sheetKey(sheet)} sheet={sheet} index={index} height={drawn} testID={id} onLoad={() => setUnder(null)}
      style={[previous && styles.loading, lift ? { transform: [{ translateY: lift }] } : undefined]} />,
  ];
  return <View pointerEvents="none" style={{ width: box, height, alignItems: 'center', justifyContent: 'flex-end' }}>
    {layers}
  </View>;
}

const keys = new WeakMap<Sheet, string>();
let nextKey = 0;
const sheetKey = (value: Sheet) => {
  if (!keys.has(value)) keys.set(value, `sheet-${++nextKey}`);
  return keys.get(value)!;
};

const styles = StyleSheet.create({ loading: { opacity: 0 } });
