import { useEffect, useState } from 'react';
import { SpriteFrame } from './Sprite';
import { useArt } from '../art/ArtProvider';

export const CANDLE_FRAME_MS = 120;

// The sprite flame is wider than the painted bright core it sits on.
const CORE_TO_CELL = 3.2;

/** Flickering flames over the painted ones of the style's room (RoomArt.candles), all on one timer, each at its own phase. Reduced motion keeps them still. */
export function CandleFlames({ point, sceneWidth, allowed }: {
  point: (x: number, y: number) => { left: number; top: number }; sceneWidth: number; allowed: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    const ticks = setInterval(() => setTick(value => (value + 1) % 8), CANDLE_FRAME_MS);
    return () => clearInterval(ticks);
  }, [allowed]);
  const { effects, room } = useArt();
  const sheet = effects.candle;
  // No wrapper: each flame blends directly with the room image drawn before it.
  return <>
    {room.candles.map((flame, index) => {
      const width = Math.max(6, flame.core * sceneWidth * CORE_TO_CELL);
      const height = width / sheet.aspect;
      const base = point(flame.x, flame.y);
      return <SpriteFrame key={index} testID={`candle-${index}`} sheet={sheet} index={(tick + index * 3) % 8} width={width}
        style={{ position: 'absolute', left: base.left - width * sheet.anchor.x, top: base.top - height * sheet.anchor.y, opacity: 0.8 }} />;
    })}
  </>;
}
