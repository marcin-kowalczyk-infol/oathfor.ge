import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { SpriteSequence } from './Sprite';
import { effectSheets, type HeroPlace, type Sheet } from './motion';

type Point = (x: number, y: number) => { left: number; top: number };

/**
 * Where each response sits on the room artwork, as fractions of it. width is the sprite cell width as a fraction of the artwork width.
 * window is the part of the shared progress in which that sprite plays.
 */
type Layer = { sheet: Sheet; x: number; y: number; width: number; window: [number, number]; id: string };
const responses: Record<HeroPlace, { duration: number; layers: Layer[] }> = {
  // The flare rises from the painted fire bed.
  hearth: { duration: 900, layers: [{ sheet: effectSheets.hearthBurst, x: 0.516, y: 0.472, width: 0.24, window: [0, 1], id: 'fx-hearth' }] },
  // The three seals light up one after another, left to right.
  seals: { duration: 1150, layers: [0.12, 0.207, 0.3].map((x, index) => ({
    sheet: effectSheets.sealGlow, x, y: 0.517, width: 0.112, window: [index * 0.15, 0.7 + index * 0.15] as [number, number], id: `fx-seal-${index}`,
  })) },
  // One page turns over the open book on the lectern.
  // Native check on iPhone 18 Pro: the page matches the open page size. Its tilt toward the book is baked into the export.
  chronicle: { duration: 800, layers: [{ sheet: effectSheets.chroniclePage, x: 0.848, y: 0.512, width: 0.13, window: [0, 1], id: 'fx-chronicle' }] },
  // Moonlight and mist spill over the threshold.
  // Native check: at the threshold behind the seals the mist only lit the seal drums. It rises from the doorway floor instead.
  door: { duration: 1100, layers: [{ sheet: effectSheets.doorMist, x: 0.19, y: 0.505, width: 0.28, window: [0, 1], id: 'fx-door' }] },
};

/** Decorative responses never delay navigation or alter committed state. */
export function StationEffect({ station, request, allowed, point, sceneWidth }: {
  station: HeroPlace; request: number; allowed: boolean; point: Point; sceneWidth: number;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const consumed = useRef<number | null>(null);
  const response = responses[station];
  useEffect(() => {
    if (consumed.current === request) { progress.setValue(1); return; }
    consumed.current = request;
    if (!allowed) { progress.setValue(1); return; }
    progress.setValue(0);
    const play = Animated.timing(progress, { toValue: 1, duration: response.duration, easing: Easing.linear, isInteraction: false, useNativeDriver: true });
    play.start();
    return () => { play.stop(); progress.stopAnimation(); };
  }, [allowed, progress, request, station]);
  // No wrapper: each light blends directly with the room image drawn before it. The layers are hidden from accessibility.
  return <>
    {response.layers.map(layer => {
      const width = layer.width * sceneWidth;
      const height = width / layer.sheet.aspect;
      const anchor = point(layer.x, layer.y);
      return <SpriteSequence key={layer.id} testID={layer.id} sheet={layer.sheet} width={width} progress={progress} start={layer.window[0]} end={layer.window[1]}
        style={{ left: anchor.left - width * layer.sheet.anchor.x, top: anchor.top - height * layer.sheet.anchor.y }} />;
    })}
  </>;
}
