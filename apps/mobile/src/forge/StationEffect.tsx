import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SpriteSequence } from './Sprite';
import { effectSheets, type HeroPlace, type Sheet } from './motion';
import { ARTWORK } from './sceneLayout';

type Point = (x: number, y: number) => { left: number; top: number };

/**
 * Where each light sits on the room artwork, as fractions of it. width is the sprite cell width as a fraction of the artwork width.
 * window is the part of the shared progress in which that sprite plays.
 */
type Layer = { sheet: Sheet; x: number; y: number; width: number; window: [number, number]; id: string };
const DURATION: Record<HeroPlace, number> = { hearth: 900, seals: 1150, chronicle: 1100, door: 1100 };
export const responseDuration = (place: HeroPlace) => DURATION[place];

// Cut layers from room-prototype-v03 (export-scene-v01.py), in artwork pixels: box x, y, width, height and the turning centre.
const drums = {
  star: { source: require('../../assets/forge/scene/room-seal-star-v01.png'), box: [62, 867, 89, 95], centre: [110.5, 919], sheet: effectSheets.sealStar, anchor: [112, 921], width: 0.0864 },
  tree: { source: require('../../assets/forge/scene/room-seal-tree-v01.png'), box: [149, 861, 85, 99], centre: [196, 915.5], sheet: effectSheets.sealTree, anchor: [195, 913], width: 0.0844 },
  wolf: { source: require('../../assets/forge/scene/room-seal-wolf-v01.png'), box: [231, 857, 85, 101], centre: [277.5, 912.5], sheet: effectSheets.sealWolf, anchor: [277, 908], width: 0.0829 },
} as const;
/** Local decision (MVP-20 planning): each drum turns once in 450 ms, 200 ms after the previous one, left to right. */
export const sealTurns = (['star', 'tree', 'wolf'] as const).map((id, index) => ({ id, start: index * 200, end: index * 200 + 450 }));
const doorLeaf = { source: require('../../assets/forge/scene/room-door-leaf-v01.png'), box: [31, 476, 94, 395], hinge: 34 };
const haze = require('../../assets/forge/ember-haze-v01.png');

const responses: Record<HeroPlace, Layer[]> = {
  // The flare rises from the painted fire bed.
  hearth: [{ sheet: effectSheets.hearthBurst, x: 0.516, y: 0.472, width: 0.24, window: [0, 1], id: 'fx-hearth' }],
  // Each motif lights from its centre while its drum turns, then fades.
  seals: sealTurns.map(turn => ({ sheet: drums[turn.id].sheet, x: drums[turn.id].anchor[0] / ARTWORK.width, y: drums[turn.id].anchor[1] / ARTWORK.height,
    width: drums[turn.id].width, window: [turn.start / DURATION.seals, Math.min(1, (turn.end + 250) / DURATION.seals)] as [number, number], id: `fx-seal-${turn.id}` })),
  // One leaf turns over the lectern book, 110 ms a frame, then signs rise once it lands (end of frame 5, 550 ms).
  chronicle: [
    { sheet: effectSheets.bookPageTurn, x: 739 / ARTWORK.width, y: 932 / ARTWORK.height, width: 0.1759, window: [0, 0.8], id: 'fx-book-page-turn' },
    { sheet: effectSheets.bookSigns, x: 735 / ARTWORK.width, y: 900 / ARTWORK.height, width: 0.1623, window: [0.5, 1], id: 'fx-book-signs' },
  ],
  // Moonlight and mist spill over the threshold.
  // Native check: at the threshold behind the seals the mist only lit the seal drums. It rises from the doorway floor instead.
  door: [{ sheet: effectSheets.doorMist, x: 0.19, y: 0.505, width: 0.28, window: [0, 1], id: 'fx-door' }],
};

/** When each sprite of a response plays, in milliseconds from its start. */
export const responseWindows = (place: HeroPlace): Record<string, [number, number]> =>
  Object.fromEntries(responses[place].map(layer => [layer.id, [layer.window[0] * DURATION[place], layer.window[1] * DURATION[place]]]));

/**
 * Decorative responses never delay navigation or alter committed state. One progress value drives every part of a response.
 * Cut layers of the room move only while a response plays, so nothing stays drawn over the room afterwards.
 */
export function StationEffect({ station, request, allowed, point, sceneWidth }: {
  station: HeroPlace; request: number; allowed: boolean; point: Point; sceneWidth: number;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const consumed = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const duration = DURATION[station];
  useEffect(() => {
    if (consumed.current === request) { progress.setValue(1); setPlaying(false); return; }
    consumed.current = request;
    if (!allowed) { progress.setValue(1); setPlaying(false); return; }
    progress.setValue(0);
    setPlaying(true);
    const play = Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, isInteraction: false, useNativeDriver: true });
    play.start(({ finished }) => { if (finished) setPlaying(false); });
    return () => { play.stop(); progress.stopAnimation(); };
  }, [allowed, progress, request, station]);
  const px = sceneWidth / ARTWORK.width;
  const at = (box: readonly number[]) => ({ ...point(box[0] / ARTWORK.width, box[1] / ARTWORK.height), width: box[2] * px, height: box[3] * px });
  // Within one response, the fraction of progress at a time in milliseconds.
  const t = (ms: number) => Math.min(1, ms / duration);
  const lights = responses[station].map(layer => {
    const width = layer.width * sceneWidth;
    const height = width / layer.sheet.aspect;
    const anchor = point(layer.x, layer.y);
    return <SpriteSequence key={layer.id} testID={layer.id} sheet={layer.sheet} width={width} progress={progress} start={layer.window[0]} end={layer.window[1]}
      style={{ left: anchor.left - width * layer.sheet.anchor.x, top: anchor.top - height * layer.sheet.anchor.y }} />;
  });
  // No wrapper: each light blends directly with the room image drawn before it. The layers are hidden from accessibility.
  return <>
    {playing && station === 'hearth' && <Animated.Image testID="fx-coals" source={haze} style={[styles.coals, { ...point(0.516, 0.47),
      opacity: progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.85, 0], extrapolate: 'clamp' }) }]} />}
    {playing && station === 'seals' && sealTurns.map(turn => {
      const drum = drums[turn.id];
      const box = at(drum.box);
      return <Animated.Image key={turn.id} testID={`cut-seal-${turn.id}`} source={drum.source} resizeMode="stretch" style={[styles.layer, box, {
        transformOrigin: [(drum.centre[0] - drum.box[0]) * px, (drum.centre[1] - drum.box[1]) * px, 0],
        transform: [{ rotate: progress.interpolate({ inputRange: [t(turn.start), t(turn.end)], outputRange: ['0deg', '360deg'], extrapolate: 'clamp' }) }] }]} />;
    })}
    {playing && station === 'door' && <>
      {/* The leaf narrows toward its hinge, so the dark doorway shows at its free edge instead of the painted leaf. */}
      <View testID="door-backing" style={[styles.layer, styles.backing, at(doorLeaf.box)]} />
      <Animated.Image testID="cut-door-leaf" source={doorLeaf.source} resizeMode="stretch" style={[styles.layer, at(doorLeaf.box), {
        transformOrigin: [(doorLeaf.hinge - doorLeaf.box[0]) * px, doorLeaf.box[3] * px / 2, 0],
        transform: [{ scaleX: progress.interpolate({ inputRange: [0, 0.35, 0.8], outputRange: [1, 0.94, 1], extrapolate: 'clamp' }) }] }]} />
    </>}
    {lights}
    {playing && station === 'seals' && sealTurns.flatMap(turn => [0, 1].map(spark => {
      const drum = drums[turn.id];
      const origin = point((drum.centre[0] + (spark ? 18 : -14)) / ARTWORK.width, (drum.centre[1] - 10) / ARTWORK.height);
      const window = [t(turn.start + 150), t(turn.end + 200)];
      return <Animated.View key={`${turn.id}-${spark}`} testID={`spark-${turn.id}-${spark}`} style={[styles.spark, { left: origin.left, top: origin.top,
        opacity: progress.interpolate({ inputRange: [window[0], (window[0] + window[1]) / 2, window[1]], outputRange: [0, 1, 0], extrapolate: 'clamp' }),
        transform: [{ translateY: progress.interpolate({ inputRange: window, outputRange: [0, 40 * px], extrapolate: 'clamp' }) }] }]} />;
    }))}
  </>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
  backing: { backgroundColor: '#0c0f16' },
  coals: { position: 'absolute', width: 150, height: 70, marginLeft: -75, marginTop: -35, tintColor: '#ff9a3c' },
  spark: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ffd28a', shadowColor: '#ffb45a', shadowOpacity: 1, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
});
