import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { CharacterBuild } from '../api/characters';
import { useArt } from '../art/ArtProvider';
import { presetArt } from '../characters/presetArt';
import { HeroSprite, WALK_FRAME_MS, type HeroPose } from './HeroSprite';
import { playerSheets } from './playerMotion';
import { FIGURE_FOOT, FIGURE_HEIGHT, FIGURE_WIDTH, walkPace } from './sceneLayout';

// Preset figures are 440 × 984 with the soles at 968 and the head at about 22. Żaromir's figure spans 284 of his 320 pixel cell,
// so the drawn image height gives both figures the same height at the same depth.
const IMAGE_HEIGHT = FIGURE_HEIGHT * (284 / 320) * (984 / 947);
const SOLES = 968 / 984;

/**
 * The player character in the Forge room, inside the same box as Żaromir's sprite with the feet at the box's foot point.
 * With sprites (the pilot starter_02 thin) it walks, breathes and plays the place poses like Żaromir.
 * DUMMY for the other presets until their sprites exist (MVP-20 later slice): the static menu figure, without step animation.
 * scale is the depth size: a fixed number at rest, or from and to over a walk.
 */
export function PlayerFigure(props: Parameters<typeof StillFigure>[0]) {
  const sheets = playerSheets(useArt(), props.presetId, props.build);
  return sheets ? <HeroSprite sheets={sheets} name="player" pose={props.pose} allowed={props.allowed} height={FIGURE_HEIGHT} scale={props.scale} run={props.run} />
    : <StillFigure {...props} />;
}

function StillFigure({ presetId, build, allowed, scale, run = 0 }: {
  presetId: string; build: CharacterBuild; pose: HeroPose; allowed: boolean;
  scale: number | { from: number; to: number; duration: number }; run?: number;
}) {
  const art = presetArt(useArt().presets, presetId, build);
  const walking = typeof scale !== 'number' && allowed;
  // A new run restarts the depth change. The size follows the walk's own curve, updated at the step rate.
  const started = useRef({ run, at: Date.now() });
  if (started.current.run !== run) started.current = { run, at: Date.now() };
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!walking) return;
    const ticks = setInterval(() => setTick(value => value + 1), WALK_FRAME_MS);
    return () => clearInterval(ticks);
  }, [walking, run]);
  const depth = typeof scale === 'number' ? scale
    : allowed ? scale.from + (scale.to - scale.from) * walkPace(Math.min(1, (Date.now() - started.current.at) / scale.duration)) : scale.to;
  const height = IMAGE_HEIGHT * depth;
  const width = height * 440 / 984;
  const soles = FIGURE_HEIGHT * FIGURE_FOOT;
  return <View pointerEvents="none" style={styles.box}>
    {art ? <Image testID="player-dummy" source={art.figure} resizeMode="contain"
      style={{ position: 'absolute', width, height, top: soles - height * SOLES, left: (FIGURE_WIDTH - width) / 2 }} />
      : <View testID="player-silhouette" style={[styles.silhouette, { height: height * 0.9, width: height * 0.3, top: soles - height * 0.9, left: (FIGURE_WIDTH - height * 0.3) / 2 }]} />}
  </View>;
}

const styles = StyleSheet.create({
  box: { width: FIGURE_WIDTH, height: FIGURE_HEIGHT },
  silhouette: { position: 'absolute', borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: 'rgba(20,16,12,0.78)' },
});
