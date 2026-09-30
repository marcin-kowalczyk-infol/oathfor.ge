import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SpriteFrame } from '../forge/Sprite';
import { useMotionAllowed } from '../ui/useMotion';
import { useArt } from '../art/ArtProvider';

const FRAMES = 8;
const FRAME_MS = 150;
const PRESS = 3;
const SPARK_MS = 60;
// The motion preference arrives shortly after mount (useMotionAllowed), like the camera flight's wait. Only then is no motion final.
const PREFERENCE_WAIT_MS = 400;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * The stamp presses the wax on the scroll (docs/product/oath-screens.md section 3). Mounted only for an Oath the server
 * has confirmed, so it never plays on the tap. Sparks burst from the press frame. Reduce Motion shows the sealed frame
 * once the preference is settled.
 */
export function SealStamp({ width, onDone, sealed = false }: { width: number; onDone(): void; sealed?: boolean }) {
  const oathArt = useArt().oaths;
  const motion = useMotionAllowed();
  const [frame, setFrame] = useState(0);
  const [spark, setSpark] = useState<number | null>(null);
  const done = useRef(onDone); done.current = onDone;
  const finished = useRef(false);
  const mountedAt = useRef(Date.now()).current;
  useEffect(() => {
    if (sealed) return;
    const finish = () => { if (!finished.current) { finished.current = true; done.current(); } };
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!motion) {
      timers.push(setTimeout(() => { setFrame(FRAMES - 1); setSpark(null); finish(); }, Math.max(0, PREFERENCE_WAIT_MS - (Date.now() - mountedAt))));
      return () => timers.forEach(clearTimeout);
    }
    for (let index = 1; index < FRAMES; index++) timers.push(setTimeout(() => setFrame(index), index * FRAME_MS));
    for (let index = 0; index < FRAMES; index++) timers.push(setTimeout(() => setSpark(index), PRESS * FRAME_MS + index * SPARK_MS));
    timers.push(setTimeout(() => setSpark(null), PRESS * FRAME_MS + FRAMES * SPARK_MS));
    timers.push(setTimeout(finish, FRAMES * FRAME_MS));
    return () => timers.forEach(clearTimeout);
  }, [motion, sealed]);
  // A sealed scroll keeps this same image element, so the end of the press never reloads it (native check, 2026-09-30).
  const shown = sealed ? FRAMES - 1 : frame;
  return <View testID={sealed ? 'seal-sealed' : 'seal-stamp'} {...hidden} accessibilityValue={{ min: 0, max: FRAMES - 1, now: shown }} style={{ width, height: width }}>
    <SpriteFrame sheet={oathArt.sealStamp} index={shown} width={width} />
    {!sealed && spark !== null && <View testID="seal-sparks" style={[styles.sparks, { width: width * 0.9, height: width * 0.9, left: width * 0.05, top: width * 0.14 }]}>
      <SpriteFrame sheet={oathArt.sealSparks} index={spark} width={width * 0.9} />
    </View>}
  </View>;
}

/** The sealed scroll as a still, for an Oath already stamped. */
export function SealedScroll({ width }: { width: number }) {
  return <SealStamp width={width} sealed onDone={() => {}} />;
}
const styles = StyleSheet.create({ sparks: { position: 'absolute' } });
