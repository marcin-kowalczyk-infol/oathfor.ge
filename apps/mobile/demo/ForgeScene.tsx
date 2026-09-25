import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useMotionAllowed } from '../src/ui/useMotion';
import en from './locales/en.json';
import pl from './locales/pl.json';

type Station = 'hearth' | 'seals' | 'chronicle';
const stations: { id: Station; x: number; y: number; footX: number; footY: number; rune: string }[] = [
  { id: 'hearth', x: 0.5, y: 0.30, footX: 0.50, footY: 0.48, rune: '◈' },
  { id: 'seals', x: 0.15, y: 0.36, footX: 0.25, footY: 0.53, rune: '◇' },
  { id: 'chronicle', x: 0.86, y: 0.39, footX: 0.76, footY: 0.54, rune: '⌁' },
];
const walkSheet = require('../assets/forge/zharomir-walk-prototype-v01.png');
const room = require('../assets/forge/room-prototype-v01.png');

/** An isolated spatial interaction study: visiting a station never mutates an Oath. */
export function ForgeScene({ locale, onExit }: { locale: 'pl' | 'en'; onExit: () => void }) {
  const copy = (locale === 'pl' ? pl : en).scene;
  const { width, fontScale } = useWindowDimensions();
  const sceneWidth = Math.min(width, 600);
  const sceneHeight = sceneWidth;
  const largeText = fontScale > 1.3;
  const allowed = useMotionAllowed();
  const [target, setTarget] = useState<Station | null>(null);
  const [arrived, setArrived] = useState<Station | null>(null);
  const [frame, setFrame] = useState(0);
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

  function choose(id: Station) {
    // Invalidate before React flushes effect cleanup, including a native completion in that gap.
    if (id !== target) generation.current++;
    setTarget(id);
  }
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onExit} style={styles.back}>
        <Text allowFontScaling={false} accessible={false} style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>{copy.back}</Text>
      </Pressable>
      <Text style={styles.prototype}>{copy.prototype}</Text>
    </View>
    <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
    <Text style={styles.hint}>{copy.hint}</Text>
    <View style={{ width: sceneWidth, height: sceneHeight }}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scenery}>
        <Image source={room} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: sceneWidth, height: sceneHeight }} />
        <View style={[styles.fireGlow, { width: sceneWidth * 0.25, height: sceneHeight * 0.23, left: sceneWidth * 0.375, top: sceneHeight * 0.22, opacity: target === 'hearth' ? 0.15 : 0 }]} />
        {stations.map(station => <View key={station.id} style={[styles.stationPool, { left: sceneWidth * station.footX - 48, top: sceneHeight * station.footY - 6, opacity: arrived === station.id ? 0.42 : target === station.id ? 0.2 : 0.04 }]} />)}
        {target && !arrived && [0, 1, 2].map(spark => <View key={spark} style={[styles.spark, { left: sceneWidth * (0.44 + spark * 0.055), top: sceneHeight * (0.42 - ((frame + spark) % 4) * 0.025), opacity: 0.25 + ((frame + spark) % 4) * 0.18 }]} />)}
      </View>
      {stations.map(station => <Pressable key={station.id} accessible={!largeText} accessibilityElementsHidden={largeText} importantForAccessibility={largeText ? "no-hide-descendants" : "auto"} accessibilityRole="button" accessibilityLabel={copy[station.id]} accessibilityHint={copy.inspect} accessibilityState={{ selected: target === station.id }} onPress={() => choose(station.id)} style={({ pressed }) => [styles.station, { left: sceneWidth * station.x - 34, top: sceneHeight * station.y - 34, opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.runeRim, target === station.id && styles.runeSelected]}><Text accessible={false} allowFontScaling={false} style={[styles.rune, target === station.id && styles.runeLit]}>{station.rune}</Text></View>
        {!largeText && <Text style={styles.stationLabel}>{copy[station.id]}</Text>}
      </Pressable>)}
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.hero, { transform: [{ translateX: position.x.interpolate({ inputRange: [0, 1], outputRange: [-50, sceneWidth - 50] }) }, { translateY: position.y.interpolate({ inputRange: [0, 1], outputRange: [-98, sceneHeight - 98] }) }] }]}>
        <View style={styles.heroShadow} />
        <View style={[styles.spriteCell, { transform: [{ translateX: [-16.5, 18, -21, 4][frame] * 100 / 627 }, { translateY: [0, 4, 19, 22][frame] * 100 / 627 + (target && !arrived && allowed ? [0, -3, 0, -2][frame] : 0) }] }]}>
          <Image source={walkSheet} resizeMode="stretch" style={{ position: 'absolute', width: 200, height: 200, left: -(frame % 2) * 100, top: -Math.floor(frame / 2) * 100 }} />
        </View>
      </Animated.View>
    </View>
    {largeText && <View style={styles.largeControls}>{stations.map(station => <Pressable key={station.id} accessibilityRole="button" accessibilityLabel={copy[station.id]} accessibilityHint={copy.inspect} accessibilityState={{ selected: target === station.id }} onPress={() => choose(station.id)} style={styles.largeControl}>
      <Text allowFontScaling={false} accessible={false} style={styles.largeRune}>{station.rune}</Text><Text style={[styles.largeLabel, target === station.id && styles.runeLit]}>{copy[station.id]}</Text>
    </Pressable>)}</View>}
    <View style={styles.stationDetail} accessibilityLiveRegion="polite">
      {target && <><Text style={styles.detailTitle}>{copy[target]}</Text><Text style={styles.description}>{arrived ? copy.descriptions[arrived] : copy.arriving}</Text></>}
      {!target && <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.idleDivider}><View style={styles.divider} /><Text allowFontScaling={false} style={styles.smallRune}>◇</Text><View style={styles.divider} /></View>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111719' },
  content: { alignItems: 'center', paddingBottom: 30 },
  header: { width: '100%', paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backArrow: { fontSize: 36, color: '#d8b773' }, backText: { fontSize: 14, color: '#ded1b5' },
  prototype: { color: '#9b8f76', fontSize: 10, letterSpacing: 2 },
  title: { fontSize: 29, color: '#f3dfb8', fontWeight: '700', marginTop: 8, paddingHorizontal: 20, textAlign: 'center' },
  hint: { color: '#b4aa95', fontSize: 14, marginTop: 7, paddingHorizontal: 24, textAlign: 'center' },
  scenery: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  fireGlow: { position: 'absolute', backgroundColor: '#ed9129', borderRadius: 200 },
  smallRune: { color: '#c29a57', fontSize: 19 },
  stationPool: { position: 'absolute', width: 96, height: 27, borderRadius: 48, backgroundColor: '#dca341', borderWidth: 1, borderColor: '#ffe0a0' },
  spark: { position: 'absolute', width: 3, height: 5, backgroundColor: '#ffc775', borderRadius: 3 },
  station: { position: 'absolute', width: 68, minHeight: 68, alignItems: 'center', zIndex: 2 },
  runeRim: { height: 62, width: 62, borderRadius: 31, borderWidth: 2, borderColor: '#8b744c', backgroundColor: '#202827', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5, shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 7, shadowOffset: { width: 0, height: 4 } },
  runeSelected: { borderColor: '#f8c56b', backgroundColor: '#51412a', shadowColor: '#ffb132', shadowOpacity: 0.825, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  rune: { color: '#b9a075', fontSize: 34 }, runeLit: { color: '#ffdb93' },
  stationLabel: { color: '#ebdab8', fontSize: 11, textAlign: 'center', width: 116, marginTop: 6, textShadowColor: '#000', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  hero: { position: 'absolute', width: 100, height: 105, zIndex: 3 },
  heroShadow: { position: 'absolute', width: 60, height: 15, borderRadius: 40, backgroundColor: '#070b0b', opacity: 0.7, bottom: 1, left: 20 },
  spriteCell: { width: 100, height: 100, overflow: 'hidden' },
  largeControls: { alignSelf: 'stretch', paddingHorizontal: 24, gap: 10 },
  largeControl: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 8 },
  largeRune: { fontSize: 32, color: '#d9b573', width: 36, textAlign: 'center' },
  largeLabel: { fontSize: 18, color: '#e0d2b7', flex: 1 },
  stationDetail: { paddingHorizontal: 30, paddingTop: 4, width: '100%', maxWidth: 560, minHeight: 85 },
  detailTitle: { color: '#f1d69e', fontSize: 20, fontWeight: '600', textAlign: 'center' },
  description: { color: '#bfb49d', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 8 },
  idleDivider: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 15, marginTop: 12 },
  divider: { width: 62, height: 1, backgroundColor: '#62543a' },
});
