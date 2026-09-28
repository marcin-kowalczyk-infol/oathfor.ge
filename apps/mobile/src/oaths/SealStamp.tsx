import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SpriteFrame } from '../forge/Sprite';
import { useMotionAllowed } from '../ui/useMotion';
import { oathArt } from './oathArt';

const FRAMES = 8;
const FRAME_MS = 150;
const PRESS = 3;
const SPARK_MS = 60;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * The stamp presses the wax on the scroll (docs/product/oath-screens.md section 3). Mounted only for an Oath the server
 * has confirmed, so it never plays on the tap. Sparks burst from the press frame. Reduce Motion shows the sealed frame.
 */
export function SealStamp({ width, onDone }: { width: number; onDone(): void }) {
  const motion = useMotionAllowed();
  const [frame, setFrame] = useState(motion ? 0 : FRAMES - 1);
  const [spark, setSpark] = useState<number | null>(null);
  const done = useRef(onDone); done.current = onDone;
  const finished = useRef(false);
  useEffect(() => {
    const finish = () => { if (!finished.current) { finished.current = true; done.current(); } };
    if (!motion) { setFrame(FRAMES - 1); setSpark(null); finish(); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let index = 1; index < FRAMES; index++) timers.push(setTimeout(() => setFrame(index), index * FRAME_MS));
    for (let index = 0; index < FRAMES; index++) timers.push(setTimeout(() => setSpark(index), PRESS * FRAME_MS + index * SPARK_MS));
    timers.push(setTimeout(() => setSpark(null), PRESS * FRAME_MS + FRAMES * SPARK_MS));
    timers.push(setTimeout(finish, FRAMES * FRAME_MS));
    return () => timers.forEach(clearTimeout);
  }, [motion]);
  return <View testID="seal-stamp" {...hidden} accessibilityValue={{ min: 0, max: FRAMES - 1, now: frame }} style={{ width, height: width }}>
    <SpriteFrame sheet={oathArt.sealStamp} index={frame} width={width} />
    {spark !== null && <View testID="seal-sparks" style={[styles.sparks, { width: width * 0.9, height: width * 0.9, left: width * 0.05, top: width * 0.14 }]}>
      <SpriteFrame sheet={oathArt.sealSparks} index={spark} width={width * 0.9} />
    </View>}
  </View>;
}

/** The sealed scroll as a still, for an Oath already stamped. */
export function SealedScroll({ width }: { width: number }) {
  return <View testID="seal-sealed" {...hidden} style={{ width, height: width }}><SpriteFrame sheet={oathArt.sealStamp} index={FRAMES - 1} width={width} /></View>;
}
const styles = StyleSheet.create({ sparks: { position: 'absolute' } });
