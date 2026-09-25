import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useMotionAllowed } from '../src/ui/useMotion';
import en from './locales/en.json';
import pl from './locales/pl.json';

type Station = 'hearth' | 'seals' | 'chronicle';
const stations: { id: Station; x: number; y: number; footX: number; footY: number }[] = [
  { id: 'hearth', x: 0.515, y: 0.45, footX: 0.515, footY: 0.565 },
  { id: 'seals', x: 0.22, y: 0.52, footX: 0.30, footY: 0.635 },
  { id: 'chronicle', x: 0.82, y: 0.51, footX: 0.72, footY: 0.65 },
];
const walkSheet = require('../assets/forge/zharomir-walk-prototype-v01.png');
const room = require('../assets/forge/room-prototype-v03.png');

/** Light belongs to the scene; the stationary touch area never scales with it. */
function SceneHotspot({ label, hint, selected, onPress, anchor, door = false, allowed, glow }: {
  label: string; hint?: string; selected?: boolean; onPress: () => void;
  anchor: { left: number; top: number }; door?: boolean; allowed: boolean; glow: Animated.Value;
}) {
  const ripple = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [touch, setTouch] = useState({ x: 38, y: 36 });
  const color = door ? '#c2efff' : '#ffdb8c';
  useEffect(() => {
    if (!allowed) { animation.current?.stop(); ripple.setValue(1); }
    return () => { animation.current?.stop(); };
  }, [allowed, ripple]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={{ selected }} onPress={onPress}
    onPressIn={({ nativeEvent }) => {
      if (!allowed) return;
      setTouch({ x: nativeEvent.locationX, y: nativeEvent.locationY });
      animation.current?.stop();
      ripple.setValue(0);
      animation.current = Animated.timing(ripple, { toValue: 1, duration: 520, isInteraction: false, useNativeDriver: true });
      animation.current.start();
    }}
    style={[door ? styles.door : styles.station, anchor]}>
    {({ pressed }) => <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cueLayer}>
      <Animated.View style={[styles.cueHalo, door && styles.doorHalo, { borderColor: color, shadowColor: color,
        opacity: pressed ? 1 : selected ? 0.85 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
        backgroundColor: pressed ? (door ? '#b5e8ff44' : '#ffd27c55') : 'transparent' }]} />
      <Animated.View style={[styles.cueMote, { backgroundColor: color, shadowColor: color,
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
        transform: [{ translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { rotate: '45deg' }] }]} />
      <Animated.View style={[styles.touchRing, { left: touch.x - 22, top: touch.y - 22, borderColor: color, shadowColor: color,
        opacity: ripple.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.95, 0.75, 0] }),
        transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.8] }) }] }]} />
    </View>}
  </Pressable>;
}

/** An isolated spatial interaction study: visiting a station never mutates an Oath. */
export function ForgeScene({ locale, onExit }: { locale: 'pl' | 'en'; onExit: () => void }) {
  const copy = (locale === 'pl' ? pl : en).scene;
  const { width, height, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const [viewport, setViewport] = useState({ width, height });
  // Artwork and every interactive anchor share this exact cover transform.
  const scale = Math.max(viewport.width / 887, viewport.height / 1774);
  const sceneWidth = scale * 887;
  const sceneHeight = scale * 1774;
  const left = (viewport.width - sceneWidth) / 2;
  const top = (viewport.height - sceneHeight) / 2;
  const point = (x: number, y: number) => ({ left: left + x * sceneWidth, top: top + y * sceneHeight });
  const hotspot = (x: number, y: number) => ({ left: Math.max(38, Math.min(viewport.width - 38, left + x * sceneWidth)), top: Math.max(48, Math.min(viewport.height - 48, top + y * sceneHeight)) });
  const allowed = useMotionAllowed();
  const [target, setTarget] = useState<Station | null>(null);
  const [arrived, setArrived] = useState<Station | null>(null);
  const [frame, setFrame] = useState(0);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const glow = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(1)).current;
  const position = useRef(new Animated.ValueXY({ x: 0.5, y: 0.82 })).current;
  const generation = useRef(0);
  const settled = useRef<Station | null>(null);

  useEffect(() => {
    const request = ++generation.current;
    if (!target || settled.current === target) return;
    const station = stations.find(item => item.id === target)!;
    const destination = { x: station.footX, y: station.footY };
    setFrame(0);
    if (!allowed) {
      position.setValue(destination);
      settled.current = target;
      setArrived(target);
      return () => { generation.current++; };
    }
    settled.current = null;
    setArrived(null);
    const ticks = setInterval(() => setFrame(value => (value + 1) % 4), 140);
    const movement = Animated.timing(position, {
      toValue: destination, duration: 840, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
    });
    movement.start(({ finished }) => {
      if (!finished || generation.current !== request) return;
      clearInterval(ticks);
      setFrame(0);
      settled.current = target;
      setArrived(target);
    });
    return () => {
      generation.current++;
      clearInterval(ticks);
      movement.stop();
    };
  }, [allowed, position, target]);

  useEffect(() => {
    if (!allowed) { glow.setValue(0.35); return; }
    const shimmer = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, isInteraction: false, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2100, isInteraction: false, useNativeDriver: true }),
    ]));
    shimmer.start();
    return () => { shimmer.stop(); glow.stopAnimation(); };
  }, [allowed, glow]);

  useEffect(() => {
    if (!bubbleOpen || !arrived || !allowed) { bubble.setValue(1); return; }
    bubble.setValue(0);
    const reveal = Animated.spring(bubble, { toValue: 1, damping: 18, stiffness: 180, mass: 0.7, useNativeDriver: true });
    reveal.start();
    return () => reveal.stop();
  }, [allowed, arrived, bubble, bubbleOpen]);

  function choose(id: Station) {
    // Invalidate before React flushes effect cleanup, including a native completion in that gap.
    if (id !== target) generation.current++;
    setBubbleOpen(true);
    setTarget(id);
  }
  const bubbleWidth = Math.min(viewport.width - 32, 340);
  const active = stations.find(station => station.id === arrived);
  const bubbleLeft = active ? Math.max(16, Math.min(viewport.width - bubbleWidth - 16, left + active.footX * sceneWidth - bubbleWidth / 2)) : 16;
  // Large text gets a scrollable lower overlay, leaving all station targets available.
  const bubbleTop = active ? Math.min(viewport.height - 130, Math.max(top + active.footY * sceneHeight + 18, viewport.height * 0.70)) : 0;
  const bubbleHeight = Math.max(100, viewport.height - bubbleTop - 20);
  return <View style={styles.root} onLayout={({ nativeEvent }) => {
    const { width: nextWidth, height: nextHeight } = nativeEvent.layout;
    if (nextWidth > 0 && nextHeight > 0) setViewport({ width: nextWidth, height: nextHeight });
  }}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scenery}>
      <Image source={room} resizeMode="stretch" style={{ position: 'absolute', left, top, width: sceneWidth, height: sceneHeight }} />
      {stations.map(station => <Animated.View key={station.id} style={[styles.objectGlow, { ...point(station.x, station.y), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: target === station.id ? [0.24, 0.42] : [0.12, 0.25] }) }]} />)}
      <Animated.View style={[styles.doorGlow, { ...point(0.17, 0.37), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.28] }) }]} />
      {stations.map(station => <View key={station.id} style={[styles.stationPool, { ...point(station.footX, station.footY), opacity: arrived === station.id ? 0.24 : target === station.id ? 0.1 : 0 }]} />)}
      {target && !arrived && [0, 1, 2].map(spark => <View key={spark} style={[styles.spark, { ...point(0.44 + spark * 0.055, 0.46 - ((frame + spark) % 4) * 0.025), opacity: 0.25 + ((frame + spark) % 4) * 0.18 }]} />)}
    </View>
    <SceneHotspot label={copy.exit} onPress={onExit} anchor={hotspot(0.17, 0.37)} door allowed={allowed} glow={glow} />
    {stations.map(station => <SceneHotspot key={station.id} label={copy[station.id]} hint={copy.inspect} selected={target === station.id} onPress={() => choose(station.id)} anchor={hotspot(station.x, station.y)} allowed={allowed} glow={glow} />)}
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.hero, { left, top, transform: [{ translateX: position.x.interpolate({ inputRange: [0, 1], outputRange: [-50, sceneWidth - 50] }) }, { translateY: position.y.interpolate({ inputRange: [0, 1], outputRange: [-98, sceneHeight - 98] }) }] }]}>
      <View style={styles.heroShadow} />
      <View style={[styles.spriteCell, { transform: [{ translateX: [-16.5, 18, -21, 4][frame] * 100 / 627 }, { translateY: [0, 4, 19, 22][frame] * 100 / 627 + (target && !arrived && allowed ? [0, -3, 0, -2][frame] : 0) }] }]}>
        <Image source={walkSheet} resizeMode="stretch" style={{ position: 'absolute', width: 200, height: 200, left: -(frame % 2) * 100, top: -Math.floor(frame / 2) * 100 }} />
      </View>
    </Animated.View>
    {bubbleOpen && arrived && <Animated.View style={[styles.bubble, { left: bubbleLeft, top: bubbleTop, width: bubbleWidth, maxHeight: bubbleHeight, height: largeText ? bubbleHeight : undefined, opacity: bubble, transform: [{ translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <View pointerEvents="none" accessible={false} style={[styles.bubbleTail, { left: Math.max(24, Math.min(bubbleWidth - 40, left + active!.footX * sceneWidth - bubbleLeft)) }]} />
      <ScrollView key={`${arrived}-${locale}-${fontScale}`} style={largeText ? { flex: 1 } : { maxHeight: bubbleHeight }} contentContainerStyle={styles.bubbleContent} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={styles.detailTitle}>{copy[arrived]}</Text>
        <Text style={styles.description}>{copy.descriptions[arrived]}</Text>
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.dismiss} onPress={() => setBubbleOpen(false)} style={styles.dismiss}><Text accessible={false} allowFontScaling={false} style={styles.dismissMark}>×</Text></Pressable>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#111719' },
  scenery: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  objectGlow: { position: 'absolute', width: 72, height: 52, marginLeft: -36, marginTop: -26, borderRadius: 36, backgroundColor: '#edb65c', shadowColor: '#ffc36a', shadowOpacity: 1, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  doorGlow: { position: 'absolute', width: 44, height: 78, marginLeft: -22, marginTop: -39, borderRadius: 24, backgroundColor: '#a1d6e0', shadowColor: '#bfe8f0', shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  stationPool: { position: 'absolute', width: 80, height: 20, marginLeft: -40, marginTop: -6, borderRadius: 40, backgroundColor: '#dca341' },
  spark: { position: 'absolute', width: 3, height: 5, backgroundColor: '#ffc775', borderRadius: 3 },
  station: { position: 'absolute', width: 76, height: 72, marginLeft: -38, marginTop: -36, borderRadius: 30, zIndex: 2 },
  cueLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cueHalo: { position: 'absolute', left: 10, right: 10, bottom: 6, height: 18, borderBottomWidth: 1.5, borderLeftWidth: 1, borderRightWidth: 1, borderRadius: 30, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  doorHalo: { left: 8, right: 8, bottom: 2 },
  cueMote: { position: 'absolute', width: 5, height: 5, top: 4, alignSelf: 'center', shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  touchRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  door: { position: 'absolute', width: 60, height: 96, marginLeft: -30, marginTop: -48, zIndex: 2 },
  hero: { position: 'absolute', width: 100, height: 105, zIndex: 3 },
  heroShadow: { position: 'absolute', width: 60, height: 15, borderRadius: 40, backgroundColor: '#070b0b', opacity: 0.7, bottom: 1, left: 20 },
  spriteCell: { width: 100, height: 100, overflow: 'hidden' },
  bubble: { position: 'absolute', zIndex: 4, backgroundColor: '#f0dfb9', borderColor: '#6c4c2f', borderWidth: 2, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  bubbleTail: { position: 'absolute', width: 18, height: 18, top: -10, backgroundColor: '#f0dfb9', borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#6c4c2f', transform: [{ rotate: '45deg' }] },
  bubbleContent: { padding: 16, paddingRight: 48 },
  detailTitle: { flexShrink: 0, color: '#47311e', fontSize: 17, fontWeight: '700' },
  description: { flexShrink: 0, color: '#523c29', fontSize: 16, marginTop: 5 },
  dismiss: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissMark: { color: '#725339', fontSize: 28 },
});
