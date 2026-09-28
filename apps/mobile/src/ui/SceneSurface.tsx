import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { HearthFire } from './HearthFire';
import { useMotionAllowed } from './useMotion';

export type ForgePlace = 'hearth' | 'seals' | 'chronicle' | 'room';
const room = require('../../assets/forge/room-prototype-v03.png');
const closeUps = {
  hearth: require('../../assets/forge/station-hearth-v01.jpg'),
  seals: require('../../assets/forge/station-seals-v01.jpg'),
  chronicle: require('../../assets/forge/station-chronicle-v01.jpg'),
};
// Station anchors in the room artwork, shared with the spatial scene.
const roomAnchors = { hearth: { x: 0.515, y: 0.45 }, seals: { x: 0.22, y: 0.52 }, chronicle: { x: 0.82, y: 0.51 } };

/** Illustrated place behind functional screens. Content owns scrolling and safe areas. */
export function SceneSurface({ children, place = 'room', approach = null, drop = 0, scroll }: { children: ReactNode; place?: ForgePlace; approach?: number | null; drop?: number; scroll?: Animated.Value }) {
  const window = useWindowDimensions();
  const motion = useMotionAllowed();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const [approaching, setApproaching] = useState<number | null>(null);
  const consumed = useRef<number | null>(null);
  const seen = useRef<{ id: number; at: number } | null>(null);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    // Leaving the place mid-approach must not leave a half-faded room over the new screen.
    if (approach === null) { progress.stopAnimation(); progress.setValue(1); setApproaching(null); return; }
    if (consumed.current === approach) return;
    if (seen.current?.id !== approach) seen.current = { id: approach, at: Date.now() };
    // A freshly mounted screen learns the motion preference a moment later. Wait briefly, never replay later.
    if (!motion && Date.now() - seen.current.at < 400) { progress.setValue(1); return; }
    consumed.current = approach;
    if (!motion || place === 'room' || Date.now() - seen.current.at >= 400) { setApproaching(null); progress.setValue(1); return; }
    setApproaching(approach);
    progress.setValue(0);
    const zoom = Animated.timing(progress, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.cubic), isInteraction: false, useNativeDriver: true });
    zoom.start(({ finished }) => { if (finished) setApproaching(current => current === approach ? null : current); });
    return () => zoom.stop();
  }, [approach, motion, place, progress]);
  useEffect(() => { if (!motion) { progress.stopAnimation(); progress.setValue(1); setApproaching(null); } }, [motion, progress]);
  // Remounted content starts at the top, so the scrolling close-up must too.
  useEffect(() => { scroll?.setValue(0); }, [window.fontScale, scroll]);

  const cover = Math.max(size.width / 887, size.height / 1774);
  const roomFrame = { width: cover * 887, height: cover * 1774, left: (size.width - cover * 887) / 2, top: (size.height - cover * 1774) / 2 };
  // Close-ups scale to width and anchor at the top. Their calm lower half fades into the page colour.
  // `drop` lowers the close-up by a fraction of the screen so its focal object meets an empty band in the layout.
  const imageHeight = size.width * 1.5;
  const imageTop = size.height * drop;
  const anchor = place === 'room' ? null : roomAnchors[place];
  return <View style={styles.root} onLayout={({ nativeEvent: { layout } }) => {
    if (layout.width > 0 && layout.height > 0) setSize({ width: layout.width, height: layout.height });
  }}>
    <View testID={`forge-place-${place}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.backdrop}>
      {place === 'room' ? <>
        <Image source={room} resizeMode="stretch" style={[styles.layer, roomFrame]} />
        <View style={[styles.backdrop, styles.quiet]} />
      </> : <Animated.View style={[styles.backdrop, { transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.14, 1] }) }], transformOrigin: [size.width / 2, imageHeight * 0.25, 0] }]}>
        {/* The close-up scrolls with the content, so text never slides across the focal object. */}
        <Animated.View style={[styles.scroller, scroll && { transform: [{ translateY: scroll.interpolate({ inputRange: [0, 1], outputRange: [0, -1], extrapolateLeft: 'clamp' }) }] }]}>
        <Image source={closeUps[place]} resizeMode="stretch" style={[styles.layer, { left: 0, top: imageTop, width: size.width, height: imageHeight }]} />
        {/* Native check: the taller 8-frame flame at 0.4 of the width rose above the arch. 0.24 keeps it inside the opening. */}
        {place === 'hearth' && <HearthFire anchor={{ left: size.width * 0.5, top: imageTop + imageHeight * 0.345 }} size={size.width * 0.24} opacity={0.85} />}
        <View style={[styles.layer, styles.fade, { left: 0, right: 0, top: imageTop, height: imageHeight }]} />
        {imageTop > 0 && <View style={[styles.layer, styles.rise, { left: 0, right: 0, top: 0, height: imageTop + imageHeight * 0.12 }]} />}
        <View style={[styles.layer, styles.floor, { left: 0, right: 0, top: imageTop + imageHeight - 1, height: 20000 }]} />
        </Animated.View>
      </Animated.View>}
      {/* Decoding every close-up early avoids a dark first frame when another place opens. */}
      {(['hearth', 'seals', 'chronicle'] as const).filter(other => other !== place).map(other => <Image key={other} source={closeUps[other]} resizeMode="stretch" style={[styles.layer, styles.preload, { width: size.width, height: imageHeight }]} />)}
      {approaching !== null && anchor && <Animated.View testID={`forge-approach-${place}`} style={[styles.backdrop, {
        opacity: progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0.85, 0] }),
        transformOrigin: [roomFrame.left + anchor.x * roomFrame.width, roomFrame.top + anchor.y * roomFrame.height, 0],
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.08, 2.8] }) }],
      }]}>
        <Image source={room} resizeMode="stretch" style={[styles.layer, roomFrame]} />
      </Animated.View>}
    </View>
    {/* iOS keeps stale text measurements after a live Dynamic Type change. Remounting the content re-measures it. */}
    <View key={window.fontScale} style={styles.content}>{children}</View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111315' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  layer: { position: 'absolute' },
  quiet: { backgroundColor: '#101719df' },
  fade: { experimental_backgroundImage: 'linear-gradient(180deg, rgba(17,19,21,0.42) 0%, rgba(17,19,21,0.40) 30%, rgba(17,19,21,0.80) 52%, rgba(17,19,21,0.93) 72%, #111315 100%)' },
  floor: { backgroundColor: '#111315' },
  content: { flex: 1 },
  preload: { left: 0, top: 0, opacity: 0 },
  scroller: { position: 'absolute', top: 0, left: 0, right: 0, height: 20000 },
  rise: { experimental_backgroundImage: 'linear-gradient(180deg, #111315 0%, #111315 70%, rgba(17,19,21,0) 100%)' },
});
