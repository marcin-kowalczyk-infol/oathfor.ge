import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useMotionAllowed } from '../ui/useMotion';
import { tokens } from '../ui/tokens';
import { StationEffect } from './StationEffect';
import { BUBBLE_FOOTER, BubbleSteps, RoomBubble } from './RoomBubble';
import { advanceTour, freshTour, hearPlace, tourControl, tourTextKey, type Tour, type TutorialPlace } from './tutorialChapters';
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
const door = { x: 0.17, y: 0.37 };
// Where Żaromir stands: next to each station, beside the door for the tutorial, and his idle place.
type Spot = TutorialPlace | 'start';
const feet: Record<Spot, { x: number; y: number }> = {
  ...Object.fromEntries(stations.map(station => [station.id, { x: station.footX, y: station.footY }])) as Record<ForgeStation, { x: number; y: number }>,
  door: { x: 0.27, y: 0.58 }, start,
};
const isStation = (spot: Spot | null): spot is ForgeStation => stations.some(station => station.id === spot);
type Direction = 'forward' | 'back' | 'left' | 'right';

/** Travel direction in artwork pixels. Diagonals favour the side view so the lantern hand stays readable. */
export function walkDirection(from: { x: number; y: number }, to: { x: number; y: number }): Direction {
  const dx = (to.x - from.x) * 887;
  const dy = (to.y - from.y) * 1774;
  if (Math.abs(dx) >= Math.abs(dy) * 0.5) return dx >= 0 ? 'right' : 'left';
  return dy < 0 ? 'back' : 'forward';
}

/** Light belongs to the scene; the stationary touch area never scales with it. */
function SceneHotspot({ label, hint, selected, onPress, anchor, door = false, allowed, glow, heard }: {
  label: string; hint?: string; selected?: boolean; onPress: () => void;
  anchor: { left: number; top: number }; door?: boolean; allowed: boolean; glow: Animated.Value; heard?: string;
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
      {heard && <Text testID={heard} allowFontScaling={false} style={styles.heard}>✓</Text>}
    </View>}
  </Pressable>;
}

/**
 * The Forge room entrance: visiting a station never mutates an Oath, only its named action leaves the room.
 * showGuide starts the four-step guide. A later change to a new truthy value (true or a restart id) starts it again.
 * tutorial starts the rules conversation, and a new id restarts it with no heard places. It takes priority over the guide.
 * onTutorialEnd reports a close or finish, so the parent can drop the id and a remount does not start it again.
 */
export function ForgeRoom({ showGuide = false, onGuideComplete, tutorial = null, onTutorialStart, onTutorialEnd, onOpenStation, onExit }: {
  showGuide?: boolean | number; onGuideComplete?: () => void; tutorial?: number | null; onTutorialStart?: () => void; onTutorialEnd?: () => void;
  onOpenStation: (station: ForgeStation) => void; onExit: () => void;
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
  const [target, setTarget] = useState<Spot | null>(null);
  const [arrived, setArrived] = useState<Spot | null>(null);
  const [frame, setFrame] = useState(0);
  const [direction, setDirection] = useState<Direction>('back');
  const [idleFrame, setIdleFrame] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const lastDestination = useRef(start);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [guideStep, setGuideStep] = useState<number | null>(() => showGuide && !tutorial ? 0 : null);
  const [tour, setTour] = useState<Tour | null>(() => tutorial ? freshTour : null);
  const tutorialRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!tutorial || tutorialRequest.current === tutorial) return;
    tutorialRequest.current = tutorial;
    setTour(freshTour); setGuideStep(null); setBubbleOpen(false);
    // A restart in an open room starts from the idle place, like the first entry.
    if (target) walkTo('start');
    onTutorialStart?.();
  }, [tutorial]);
  const guideRequest = useRef(showGuide);
  useEffect(() => {
    if (guideRequest.current === showGuide) return;
    guideRequest.current = showGuide;
    // A restart replaces whatever station the player had open, so its bubble never returns after the guide.
    if (showGuide && !tour) { setGuideStep(0); setBubbleOpen(false); }
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
  const settled = useRef<Spot | null>(null);

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
    const destination = feet[target];
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
  const telling = !!tour?.place && arrived === tour.place;
  // Between chapters Żaromir waits at the last place without its station pose.
  const posed = isStation(arrived) && (!tour || telling);
  const idle = !walking && !posed;
  useEffect(() => {
    // A slow breathing loop only while standing without a station pose.
    if (!allowed || !idle) { setIdleFrame(0); return; }
    const breath = setInterval(() => setIdleFrame(value => (value + 1) % 4), 650);
    return () => clearInterval(breath);
  }, [allowed, idle]);
  const placeBubble = tour ? telling : bubbleOpen && isStation(arrived);

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
    if (!placeBubble || !allowed) { bubble.setValue(1); return; }
    bubble.setValue(0);
    const reveal = Animated.spring(bubble, { toValue: 1, damping: 18, stiffness: 180, mass: 0.7, useNativeDriver: true });
    reveal.start();
    return () => reveal.stop();
  }, [allowed, arrived, bubble, placeBubble]);

  function choose(id: ForgeStation) {
    finishGuide();
    // Invalidate before React flushes effect cleanup, including a native completion in that gap.
    if (id !== target) generation.current++;
    setTouchRequest(value => value + 1);
    setBubbleOpen(true);
    setTarget(id);
  }
  function walkTo(spot: Spot) {
    if (spot !== target) generation.current++;
    setTarget(spot);
  }
  function hear(place: TutorialPlace) {
    if (tour?.place === place) return;
    if (isStation(place)) setTouchRequest(value => value + 1);
    setTour(current => current && hearPlace(current, place));
    walkTo(place);
  }
  const control = tour && telling ? tourControl(tour) : null;
  function endTour() {
    setTour(null);
    onTutorialEnd?.();
  }
  function advance() {
    setTour(current => current && advanceTour(current));
  }
  const placeLabel = (place: TutorialPlace) => tour
    ? `${t('room.tutorial.hear', { place: t(`room.${place}`) })}${tour.heard.includes(place) ? `, ${t('room.tutorial.heard')}` : ''}`
    : t(place === 'door' ? 'room.exit' : `room.${place}`);
  const heardMark = (place: TutorialPlace) => tour?.heard.includes(place) ? `heard-${place}` : undefined;
  const bubbleWidth = Math.min(viewport.width - 32, 340);
  const footSpot = tour ? (telling ? arrived : null) : arrived === 'start' ? null : arrived;
  // The bubble sits outside the camera layer, so project scene points through the camera zoom.
  const zoom = zoomed ? 1.08 : 1;
  const onScreen = (x: number, y: number) => ({ x: viewport.width * 0.515 + (left + x * sceneWidth - viewport.width * 0.515) * zoom, y: viewport.height * 0.45 + (top + y * sceneHeight - viewport.height * 0.45) * zoom });
  const foot = footSpot ? onScreen(feet[footSpot].x, feet[footSpot].y) : null;
  // The guide tail points toward the place it describes, the tutorial choice toward Żaromir where he waits.
  const guideAnchor = guidePlace === 'door' ? door : stations.find(station => station.id === guidePlace);
  const centeredX = guideAnchor ? onScreen(guideAnchor.x, guideAnchor.y).x : tour ? onScreen(feet[target ?? 'start'].x, feet[target ?? 'start'].y).x : viewport.width / 2;
  const centered = !!guidePlace || (!!tour && !telling);
  const bubbleLeft = foot ? Math.max(16, Math.min(viewport.width - bubbleWidth - 16, foot.x - bubbleWidth / 2)) : 16;
  // Large text gets a scrollable lower overlay, leaving all station targets available.
  // Large text raises the overlay floor, still below the station touch areas.
  const floor = viewport.height * (largeText ? 0.58 : 0.70);
  const preferredTop = foot && !largeText ? Math.min(viewport.height - 130, Math.max(foot.y + 18, floor)) : floor;
  // A bubble taller than the space below its place grows upward, as far as the lower edge of the station touch areas.
  // The native SE 3 check clipped the guide text and the station action at the bottom edge.
  const footer = guidePlace ? <BubbleSteps count={`${guideStep! + 1} / 4`} label={t(guideStep === 3 ? 'room.guide.done' : 'room.guide.next')} mark={guideStep === 3 ? '✓' : '→'}
      onPress={() => guideStep === 3 ? finishGuide() : setGuideStep(value => value! + 1)} />
    : tour?.ended ? <BubbleSteps count="" label={t('room.tutorial.finish')} text onPress={() => endTour()} />
    : control ? <BubbleSteps count={`${control.line} / ${control.lines}`} label={t(`room.tutorial.${control.action}`)} mark="→" text={control.action !== 'next'} onPress={advance} />
    : null;
  const natural = contentHeight + 4 + (footer ? BUBBLE_FOOTER : 0);
  const stationEdge = Math.max(...stations.map(station => viewport.height * 0.45 + (hotspot(station.x, station.y).top + 36 - viewport.height * 0.45) * zoom));
  const bubbleTop = largeText || contentHeight === 0 ? preferredTop : Math.min(preferredTop, Math.max(stationEdge, viewport.height - 20 - natural));
  const sprite = walking
    ? { sheet: sheets[direction], index: frame, id: `hero-walk-${direction}` }
    : posed && isStation(arrived) ? { sheet: sheets.actions, index: stationPose[arrived], id: `hero-pose-${arrived}` }
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
      {stations.map(station => <Animated.Image source={require('../../assets/forge/ember-haze-v01.png')} key={station.id} style={[styles.objectGlow, { ...point(station.x, station.y), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === station.id || tour?.place === station.id ? [0.45, 0.75] : target === station.id || tour ? [0.30, 0.60] : [0.16, 0.48] }) }]} />)}
      <Animated.Image source={require('../../assets/forge/ember-haze-v01.png')} style={[styles.doorGlow, { ...point(door.x, door.y), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === 'door' || tour?.place === 'door' ? [0.45, 0.72] : tour ? [0.30, 0.60] : [0.16, 0.48] }) }]} />
      {isStation(target) && <StationEffect station={target} request={touchRequest} allowed={allowed} anchor={point(stations.find(item => item.id === target)!.x, stations.find(item => item.id === target)!.y)} />}
      {target && !arrived && [0, 1, 2].map(spark => <View key={spark} style={[styles.spark, { ...point(0.44 + spark * 0.055, 0.46 - ((frame + spark) % 4) * 0.025), opacity: 0.25 + ((frame + spark) % 4) * 0.18 }]} />)}
    </View>
    <SceneHotspot label={placeLabel('door')} onPress={() => { if (tour) { hear('door'); return; } finishGuide(); onExit(); }} anchor={hotspot(door.x, door.y)} door allowed={allowed} glow={glow} heard={heardMark('door')} selected={tour ? tour.place === 'door' : undefined} />
    {stations.map(station => <SceneHotspot key={station.id} label={placeLabel(station.id)} hint={tour ? undefined : t('room.inspect')} selected={tour ? tour.place === station.id : target === station.id}
      onPress={() => tour ? hear(station.id) : choose(station.id)} anchor={hotspot(station.x, station.y)} allowed={allowed} glow={glow} heard={heardMark(station.id)} />)}
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.hero, { left, top, transform: [{ translateX: position.x.interpolate({ inputRange: [0, 1], outputRange: [-cell / 2, sceneWidth - cell / 2] }) }, { translateY: position.y.interpolate({ inputRange: [0, 1], outputRange: [-cell * 0.95, sceneHeight - cell * 0.95] }) }] }]}>
      <View style={styles.heroShadow} />
      <View testID={sprite.id} style={[styles.spriteCell, { transform: [{ translateY: walking && allowed ? [0, -2, 0, -2][frame] : 0 }] }]}>
        <Image source={sprite.sheet} resizeMode="stretch" style={{ position: 'absolute', width: cell * 2, height: cell * 2, left: -(sprite.index % 2) * cell, top: -Math.floor(sprite.index / 2) * cell }} />
      </View>
    </Animated.View>
    </Animated.View>
    {(guidePlace || (tour && (telling || !tour.place)) || placeBubble) && <RoomBubble
      frame={{ left: centered ? (viewport.width - bubbleWidth) / 2 : bubbleLeft, top: bubbleTop, width: bubbleWidth, maxHeight: bubbleHeight, height: largeText ? bubbleHeight : undefined }}
      reveal={centered ? null : bubble} pointX={centered ? centeredX : foot!.x} fill={largeText}
      contentKey={`${guidePlace ?? (tour ? `tour-${tour.place}-${tour.line}-${tour.ended}` : arrived)}-${i18n.language}-${fontScale}`}
      onContentHeight={setContentHeight} dismissLabel={t(guidePlace ? 'room.guide.skip' : tour ? 'room.tutorial.close' : 'room.dismiss')}
      onDismiss={() => guidePlace ? finishGuide() : tour ? endTour() : setBubbleOpen(false)} footer={footer}>
      {!guidePlace && !tour && isStation(arrived) && <Text accessibilityRole="header" maxFontSizeMultiplier={2.4} style={styles.detailTitle}>{t(`room.${arrived}`)}</Text>}
      <Text maxFontSizeMultiplier={2} style={styles.description}>{guidePlace ? t(`room.guide.${guidePlace}`)
        : tour ? t(tourTextKey(tour))
        : t(`room.descriptions.${arrived}`)}</Text>
      {!guidePlace && !tour && isStation(arrived) && <Pressable accessibilityRole="button" accessibilityLabel={t(`room.actions.${arrived}`)} onPress={() => onOpenStation(arrived)} style={({ pressed }) => [styles.stationAction, { opacity: pressed ? 0.6 : 1 }]}>
        <Text maxFontSizeMultiplier={2} style={styles.actionLabel}>{t(`room.actions.${arrived}`)} <Text accessibilityElementsHidden>→</Text></Text>
      </Pressable>}
    </RoomBubble>}
  </View>;
}

const styles = StyleSheet.create({
  heard: { position: 'absolute', top: -6, right: 4, color: '#ffdb8c', fontSize: 15, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
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
  detailTitle: { flexShrink: 0, color: '#47311e', fontFamily: tokens.font.display, fontSize: 19, fontWeight: '400' },
  description: { flexShrink: 0, color: '#523c29', fontFamily: tokens.font.body, fontSize: 16, lineHeight: 23, marginTop: 5 },
});
