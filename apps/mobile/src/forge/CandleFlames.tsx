import { useEffect, useState } from 'react';
import { SpriteFrame } from './Sprite';
import { effectSheets } from './motion';

export const CANDLE_FRAME_MS = 120;

/**
 * Painted flames in room-prototype-v03, measured as the bright core: base centre and core width, as fractions of the artwork.
 * room-final-v01 keeps the same layout.
 */
export const candles: readonly { x: number; y: number; core: number }[] = [
  // Chandelier.
  { x: 0.409, y: 0.138, core: 0.007 }, { x: 0.439, y: 0.134, core: 0.006 }, { x: 0.512, y: 0.129, core: 0.009 }, { x: 0.581, y: 0.135, core: 0.006 },
  { x: 0.606, y: 0.139, core: 0.008 }, { x: 0.493, y: 0.156, core: 0.006 }, { x: 0.559, y: 0.154, core: 0.006 },
  // Hanging lamps.
  { x: 0.183, y: 0.191, core: 0.016 }, { x: 0.814, y: 0.194, core: 0.01 }, { x: 0.053, y: 0.244, core: 0.014 }, { x: 0.944, y: 0.245, core: 0.01 },
  // Wall braziers beside the door and the hearth.
  { x: 0.223, y: 0.404, core: 0.01 }, { x: 0.316, y: 0.43, core: 0.012 }, { x: 0.709, y: 0.43, core: 0.015 },
  // Lectern candle and pedestal bowls.
  { x: 0.906, y: 0.475, core: 0.015 }, { x: 0.057, y: 0.542, core: 0.015 }, { x: 0.362, y: 0.53, core: 0.01 }, { x: 0.947, y: 0.545, core: 0.016 },
  // Foreground braziers at the lower corners.
  { x: 0.015, y: 0.798, core: 0.032 }, { x: 0.983, y: 0.798, core: 0.033 },
];

// The sprite flame is wider than the painted bright core it sits on.
const CORE_TO_CELL = 3.2;

/** Flickering flames over the painted ones, all on one timer, each at its own phase. Reduced motion keeps them still. */
export function CandleFlames({ point, sceneWidth, allowed }: {
  point: (x: number, y: number) => { left: number; top: number }; sceneWidth: number; allowed: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    const ticks = setInterval(() => setTick(value => (value + 1) % 8), CANDLE_FRAME_MS);
    return () => clearInterval(ticks);
  }, [allowed]);
  const sheet = effectSheets.candle;
  // No wrapper: each flame blends directly with the room image drawn before it.
  return <>
    {candles.map((flame, index) => {
      const width = Math.max(6, flame.core * sceneWidth * CORE_TO_CELL);
      const height = width / sheet.aspect;
      const base = point(flame.x, flame.y);
      return <SpriteFrame key={index} testID={`candle-${index}`} sheet={sheet} index={(tick + index * 3) % 8} width={width}
        style={{ position: 'absolute', left: base.left - width * sheet.anchor.x, top: base.top - height * sheet.anchor.y, opacity: 0.8 }} />;
    })}
  </>;
}
