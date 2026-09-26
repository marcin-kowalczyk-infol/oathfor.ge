import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useMotionAllowed } from '../ui/useMotion';
import { tokens } from '../ui/tokens';
import { StationEffect } from './StationEffect';
import { HearthFire } from '../ui/HearthFire';
import { useTranslation } from '../localization/LocalizationProvider';

export type ForgeStation = 'hearth' | 'seals' | 'chronicle';
const stations: { id: ForgeStation; x: number; y: number; footX: number; footY: number }[] = [
  { id: 'hearth', x: 0.515, y: 0.45, footX: 0.515, footY: 0.565 },
  { id: 'seals', x: 0.22, y: 0.52, footX: 0.30, footY: 0.635 },
  { id: 'chronicle', x: 0.82, y: 0.51, footX: 0.72, footY: 0.65 },
];
const room = require('../../assets/forge/room-prototype-v03.png');
// Cells are pre-aligned in export: feet at 95% of the cell, head centred, one shared scale.
const sheets = {
  forward: require('../../assets/forge/zharomir-walk-forward-v01.png'),
  back: require('../../assets/forge/zharomir-walk-back-v01.png'),
  left: require('../../assets/forge/zharomir-walk-left-v01.png'),
  right: require('../../assets/forge/zharomir-walk-right-v01.png'),
  idle: require('../../assets/forge/zharomir-idle-v01.png'),
  actions: require('../../assets/forge/zharomir-station-actions-v01.png'),
};
// Station poses: embers, open-hand presentation, reading. The raised-palm seal pose reads as "stop" and is unused.
const stationPose: Record<ForgeStation, number> = { hearth: 0, seals: 3, chronicle: 2 };
const cell = 116;
const start = { x: 0.5, y: 0.82 };
type Direction = 'forward' | 'back' | 'left' | 'right';

/** Travel direction in artwork pixels. Diagonals favour the side view so the lantern hand stays readable. */
export function walkDirection(from: { x: number; y: number }, to: { x: number; y: number }): Direction {
  const dx = (to.x - from.x) * 887;
  const dy = (to.y - from.y) * 1774;
  if (Math.abs(dx) >= Math.abs(dy) * 0.5) return dx >= 0 ? 'right' : 'left';
  return dy < 0 ? 'back' : 'forward';
}

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
      <Animated.View style={[styles.cueMote, { backgroundColor: color, shadowColor: color,
        opacity: pressed || selected ? 1 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{ translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { rotate: '45deg' }] }]} />
      <Animated.View style={[styles.touchRing, { left: touch.x - 22, top: touch.y - 22, borderColor: color, shadowColor: color,
        opacity: ripple.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.95, 0.75, 0] }),
        transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.8] }) }] }]} />
    </View>}
  </Pressable>;
}

/**
 * The Forge room entrance: visiting a station never mutates an Oath, only its named action leaves the room.
 * showGuide starts the four-step guide. A later change to a new truthy value (true or a restart id) starts it again.
 */
export function ForgeRoom({ showGuide = false, onGuideComplete, onOpenStation, onExit }: {
  showGuide?: boolean | number; onGuideComplete?: () => void; onOpenStation: (station: ForgeStation) => void; onExit: () => void;
}) {
  const { t, i18n } = useTranslation();
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
  const [target, setTarget] = useState<ForgeStation | null>(null);
  const [arrived, setArrived] = useState<ForgeStation | null>(null);
  const [frame, setFrame] = useState(0);
  const [direction, setDirection] = useState<Direction>('back');
  const [idleFrame, setIdleFrame] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const lastDestination = useRef(start);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [guideStep, setGuideStep] = useState<number | null>(() => showGuide ? 0 : null);
  const guideRequest = useRef(showGuide);
  useEffect(() => {
    if (guideRequest.current === showGuide) return;
    guideRequest.current = showGuide;
    // A restart replaces whatever station the player had open, so its bubble never returns after the guide.
    if (showGuide) { setGuideStep(0); setBubbleOpen(false); }
  }, [showGuide]);
  const guidePlace = guideStep === null ? null : (['hearth', 'seals', 'chronicle', 'door'] as const)[guideStep];
  function finishGuide() {
    if (guideStep === null) return;
    setGuideStep(null);
    onGuideComplete?.();
  }
  const camera = useRef(new Animated.Value(0)).current;
  const entered = useRef(false);
  const [touchRequest, setTouchRequest] = useState(0);
  const glow = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(1)).current;
  const position = useRef(new Animated.ValueXY(start)).current;
  const generation = useRef(0);
  const settled = useRef<ForgeStation | null>(null);

  useEffect(() => {
    if (!allowed) { camera.setValue(entered.current ? 1 : 0); return; }
    if (entered.current) { camera.setValue(1); return; }
    entered.current = true;
    setZoomed(true);
    const approach = Animated.timing(camera, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), isInteraction: false, useNativeDriver: true });
    approach.start();
    return () => approach.stop();
  }, [allowed, camera]);

  useEffect(() => {
    const request = ++generation.current;
    if (!target || settled.current === target) return;
    const station = stations.find(item => item.id === target)!;
    const destination = { x: station.footX, y: station.footY };
    setDirection(walkDirection(lastDestination.current, destination));
    lastDestination.current = destination;
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

  const walking = !!target && !arrived;
  useEffect(() => {
    // A slow breathing loop only while standing without a station pose.
    if (!allowed || target) { setIdleFrame(0); return; }
    const breath = setInterval(() => setIdleFrame(value => (value + 1) % 4), 650);
    return () => clearInterval(breath);
  }, [allowed, target]);

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

  function choose(id: ForgeStation) {
    finishGuide();
    // Invalidate before React flushes effect cleanup, including a native completion in that gap.
    if (id !== target) generation.current++;
    setTouchRequest(value => value + 1);
    setBubbleOpen(true);
    setTarget(id);
  }
  const bubbleWidth = Math.min(viewport.width - 32, 340);
  const active = stations.find(station => station.id === arrived);
  // The bubble sits outside the camera layer, so project scene points through the camera zoom.
  const zoom = zoomed ? 1.08 : 1;
  const onScreen = (x: number, y: number) => ({ x: viewport.width * 0.515 + (left + x * sceneWidth - viewport.width * 0.515) * zoom, y: viewport.height * 0.45 + (top + y * sceneHeight - viewport.height * 0.45) * zoom });
  const foot = active ? onScreen(active.footX, active.footY) : null;
  // The guide tail points toward the place it describes.
  const guideAnchor = guidePlace === 'door' ? { x: 0.17, y: 0.37 } : stations.find(station => station.id === guidePlace);
  const guideX = guideAnchor ? onScreen(guideAnchor.x, guideAnchor.y).x : viewport.width / 2;
  const bubbleLeft = foot ? Math.max(16, Math.min(viewport.width - bubbleWidth - 16, foot.x - bubbleWidth / 2)) : 16;
  // Large text gets a scrollable lower overlay, leaving all station targets available.
  // Large text raises the overlay floor, still below the station touch areas.
  const floor = viewport.height * (largeText ? 0.58 : 0.70);
  const bubbleTop = foot && !largeText ? Math.min(viewport.height - 130, Math.max(foot.y + 18, floor)) : floor;
  const sprite = walking
    ? { sheet: sheets[direction], index: frame, id: `hero-walk-${direction}` }
    : arrived ? { sheet: sheets.actions, index: stationPose[arrived], id: `hero-pose-${arrived}` }
    : { sheet: sheets.idle, index: idleFrame, id: 'hero-idle' };
  const bubbleHeight = Math.max(100, viewport.height - bubbleTop - 20);
  return <View style={styles.root} onLayout={({ nativeEvent }) => {
    const { width: nextWidth, height: nextHeight } = nativeEvent.layout;
    if (nextWidth > 0 && nextHeight > 0) setViewport({ width: nextWidth, height: nextHeight });
  }}>
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [viewport.width * 0.515, viewport.height * 0.45, 0], transform: [{ scale: camera.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scenery}>
      <Image source={room} resizeMode="stretch" style={{ position: 'absolute', left, top, width: sceneWidth, height: sceneHeight }} />
      <HearthFire anchor={point(0.515, 0.463)} size={sceneWidth * 0.17} opacity={0.8} />
      {stations.map(station => <Animated.Image source={require('../../assets/forge/ember-haze-v01.png')} key={station.id} style={[styles.objectGlow, { ...point(station.x, station.y), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === station.id ? [0.45, 0.75] : target === station.id ? [0.30, 0.60] : [0.16, 0.48] }) }]} />)}
      <Animated.Image source={require('../../assets/forge/ember-haze-v01.png')} style={[styles.doorGlow, { ...point(0.17, 0.37), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === 'door' ? [0.45, 0.72] : [0.16, 0.48] }) }]} />
      {target && <StationEffect station={target} request={touchRequest} allowed={allowed} anchor={point(stations.find(item => item.id === target)!.x, stations.find(item => item.id === target)!.y)} />}
      {target && !arrived && [0, 1, 2].map(spark => <View key={spark} style={[styles.spark, { ...point(0.44 + spark * 0.055, 0.46 - ((frame + spark) % 4) * 0.025), opacity: 0.25 + ((frame + spark) % 4) * 0.18 }]} />)}
    </View>
    <SceneHotspot label={t('room.exit')} onPress={() => { finishGuide(); onExit(); }} anchor={hotspot(0.17, 0.37)} door allowed={allowed} glow={glow} />
    {stations.map(station => <SceneHotspot key={station.id} label={t(`room.${station.id}`)} hint={t('room.inspect')} selected={target === station.id} onPress={() => choose(station.id)} anchor={hotspot(station.x, station.y)} allowed={allowed} glow={glow} />)}
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.hero, { left, top, transform: [{ translateX: position.x.interpolate({ inputRange: [0, 1], outputRange: [-cell / 2, sceneWidth - cell / 2] }) }, { translateY: position.y.interpolate({ inputRange: [0, 1], outputRange: [-cell * 0.95, sceneHeight - cell * 0.95] }) }] }]}>
      <View style={styles.heroShadow} />
      <View testID={sprite.id} style={[styles.spriteCell, { transform: [{ translateY: walking && allowed ? [0, -2, 0, -2][frame] : 0 }] }]}>
        <Image source={sprite.sheet} resizeMode="stretch" style={{ position: 'absolute', width: cell * 2, height: cell * 2, left: -(sprite.index % 2) * cell, top: -Math.floor(sprite.index / 2) * cell }} />
      </View>
    </Animated.View>
    </Animated.View>
    {(guidePlace || (bubbleOpen && arrived)) && <Animated.View style={[styles.bubble, { left: guidePlace ? (viewport.width - bubbleWidth) / 2 : bubbleLeft, top: bubbleTop, width: bubbleWidth, maxHeight: bubbleHeight, height: largeText ? bubbleHeight : undefined, opacity: guidePlace ? 1 : bubble, transform: [{ translateY: guidePlace ? 0 : bubble.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <View pointerEvents="none" accessible={false} style={[styles.bubbleTail, { left: Math.max(24, Math.min(bubbleWidth - 40, (guidePlace ? guideX : foot!.x) - (guidePlace ? (viewport.width - bubbleWidth) / 2 : bubbleLeft) - 9)) }]} />
      <ScrollView key={`${guidePlace ?? arrived}-${i18n.language}-${fontScale}`} style={largeText ? { flex: 1 } : { flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.bubbleContent} accessibilityLiveRegion="polite">
        <View style={styles.speakerRow}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.avatar}>
            <Image source={require('../../assets/companion/zharomir-wanderer-v01.png')} resizeMode="stretch" style={styles.avatarImage} />
          </View>
          <Text maxFontSizeMultiplier={2} style={styles.speaker}>{t('room.speaker')}</Text>
        </View>
        {!guidePlace && arrived && <Text accessibilityRole="header" maxFontSizeMultiplier={2.4} style={styles.detailTitle}>{t(`room.${arrived}`)}</Text>}
        <Text maxFontSizeMultiplier={2} style={styles.description}>{guidePlace ? t(`room.guide.${guidePlace}`) : t(`room.descriptions.${arrived}`)}</Text>
        {!guidePlace && arrived && <Pressable accessibilityRole="button" accessibilityLabel={t(`room.actions.${arrived}`)} onPress={() => onOpenStation(arrived)} style={({ pressed }) => [styles.stationAction, { opacity: pressed ? 0.6 : 1 }]}>
          <Text maxFontSizeMultiplier={2} style={styles.actionLabel}>{t(`room.actions.${arrived}`)} <Text accessibilityElementsHidden>→</Text></Text>
        </Pressable>}
      </ScrollView>
      {guidePlace && <View style={styles.guideFooter}>
        <Text accessible={false} allowFontScaling={false} style={styles.stepCount}>{guideStep! + 1} / 4</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t(guideStep === 3 ? 'room.guide.done' : 'room.guide.next')} onPress={() => guideStep === 3 ? finishGuide() : setGuideStep(value => value! + 1)} style={styles.guideNext}>
          <Text accessible={false} allowFontScaling={false} style={styles.nextMark}>{guideStep === 3 ? '✓' : '→'}</Text>
        </Pressable>
      </View>}
      <Pressable accessibilityRole="button" accessibilityLabel={t(guidePlace ? 'room.guide.skip' : 'room.dismiss')} onPress={() => guidePlace ? finishGuide() : setBubbleOpen(false)} style={styles.dismiss}><Text accessible={false} allowFontScaling={false} style={styles.dismissMark}>×</Text></Pressable>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  stationAction: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  actionLabel: { color: '#5d3616', fontSize: 17, fontWeight: '600' },
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#111719' },
  scenery: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  objectGlow: { position: 'absolute', width: 180, height: 160, marginLeft: -90, marginTop: -85 },
  doorGlow: { position: 'absolute', width: 130, height: 180, marginLeft: -65, marginTop: -95, tintColor: '#bfe8f0' },
  spark: { position: 'absolute', width: 3, height: 5, backgroundColor: '#ffc775', borderRadius: 3 },
  station: { position: 'absolute', width: 76, height: 72, marginLeft: -38, marginTop: -36, borderRadius: 30, zIndex: 2 },
  cueLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cueMote: { position: 'absolute', width: 5, height: 5, top: 4, alignSelf: 'center', shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  touchRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  door: { position: 'absolute', width: 60, height: 96, marginLeft: -30, marginTop: -48, zIndex: 2 },
  hero: { position: 'absolute', width: cell, height: cell, zIndex: 3 },
  heroShadow: { position: 'absolute', width: 76, height: 18, top: cell * 0.95 - 10, left: cell / 2 - 38, experimental_backgroundImage: 'radial-gradient(ellipse closest-side at center, rgba(4,6,6,0.62) 0%, rgba(4,6,6,0.35) 55%, rgba(4,6,6,0) 100%)' },
  spriteCell: { width: cell, height: cell, overflow: 'hidden' },
  bubble: { position: 'absolute', zIndex: 4, backgroundColor: '#f0dfb9', borderColor: '#6c4c2f', borderWidth: 2, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  bubbleTail: { position: 'absolute', width: 18, height: 18, top: -10, backgroundColor: '#f0dfb9', borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#6c4c2f', transform: [{ rotate: '45deg' }] },
  bubbleContent: { padding: 12, paddingRight: 40 },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#44372c', flexShrink: 0 },
  avatarImage: { position: 'absolute', width: 180.224, height: 270.336, left: -73.92, top: -3.52 },
  speaker: { color: '#47311e', fontFamily: tokens.font.body, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  guideFooter: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 6 },
  guideNext: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center' },
  nextMark: { color: '#69431e', fontSize: 30 },
  stepCount: { color: '#725339', fontSize: 12 },
  detailTitle: { flexShrink: 0, color: '#47311e', fontFamily: tokens.font.display, fontSize: 19, fontWeight: '400' },
  description: { flexShrink: 0, color: '#523c29', fontFamily: tokens.font.body, fontSize: 16, lineHeight: 23, marginTop: 5 },
  dismiss: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissMark: { color: '#725339', fontSize: 28 },
});
