import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useMotionAllowed } from '../ui/useMotion';
import { tokens } from '../ui/tokens';
import { StationEffect } from './StationEffect';
import { SceneHotspot } from './SceneHotspot';
import { BUBBLE_FOOTER, BubbleSteps, RoomBubble } from './RoomBubble';
import { advanceTour, freshTour, hearPlace, tourControl, tourTextKey, type Tour, type TutorialPlace } from './tutorialChapters';
import { HearthFire } from '../ui/HearthFire';
import { HeroSprite, ACT_BEFORE_TURN_MS, TURN_FRAME_MS, type HeroPose } from './HeroSprite';
import { CandleFlames } from './CandleFlames';
import { SpriteLoop } from './Sprite';
import { effectSheets } from './motion';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { FIGURE_FOOT, FIGURE_HEIGHT, FIGURE_WIDTH, places, playerStart, SEALS_BOX, SEALS_FRONT_Y, tutor } from './sceneLayout';
import { useWalker } from './useWalker';

export type ForgeStation = 'hearth' | 'seals' | 'chronicle';
const stations: { id: ForgeStation; x: number; y: number; footX: number; footY: number }[] = [
  { id: 'hearth', ...places.hearth.anchor, footX: 0.515, footY: 0.565 },
  { id: 'seals', ...places.seals.anchor, footX: 0.30, footY: 0.635 },
  { id: 'chronicle', ...places.chronicle.anchor, footX: 0.72, footY: 0.65 },
];
const room = require('../../assets/forge/room-prototype-v03.png');
const sealsFront = require('../../assets/forge/motion/room-seals-front-v01.png');
const haze = require('../../assets/forge/ember-haze-v01.png');
const WISP = 22;
const start = playerStart;
const door = places.door.anchor;
// Where Żaromir stands: next to each station, in the doorway and in front of the hearth for the tutorial, and his idle place.
// Native check on iPhone 18 Pro: from the start point he stood behind the tutorial bubble, and a door point at (0.27, 0.58) stood him on the seals.
type Spot = TutorialPlace | 'start' | 'tutor';
const feet: Record<Spot, { x: number; y: number }> = {
  ...Object.fromEntries(stations.map(station => [station.id, { x: station.footX, y: station.footY }])) as Record<ForgeStation, { x: number; y: number }>,
  door: { x: 0.19, y: 0.50 }, tutor, start,
};
const isStation = (spot: Spot | null): spot is ForgeStation => stations.some(station => station.id === spot);

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
  const hero = useWalker(feet, start, allowed);
  const { target, arrived, walking, direction, position, walkTo } = hero;
  const [zoomed, setZoomed] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [guideStep, setGuideStep] = useState<number | null>(() => showGuide && !tutorial ? 0 : null);
  const [tour, setTour] = useState<Tour | null>(() => tutorial ? freshTour : null);
  const tutorialRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!tutorial || tutorialRequest.current === tutorial) return;
    tutorialRequest.current = tutorial;
    setTour(freshTour); setGuideStep(null); setBubbleOpen(false);
    // Żaromir walks into the room from the start point to talk, above the bubble.
    walkTo('tutor');
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

  useEffect(() => {
    if (!allowed) { camera.setValue(entered.current ? 1 : 0); return; }
    if (entered.current) { camera.setValue(1); return; }
    entered.current = true;
    setZoomed(true);
    const approach = Animated.timing(camera, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), isInteraction: false, useNativeDriver: true });
    approach.start();
    return () => approach.stop();
  }, [allowed, camera]);

  const telling = !!tour?.place && arrived === tour.place;
  // At a told place he first works facing it, then turns around and talks. Reduced motion keeps the facing pose.
  const [presence, setPresence] = useState<'act' | 'turn' | 'talk'>('act');
  useEffect(() => {
    setPresence('act');
    if (!telling || !allowed) return;
    const turn = setTimeout(() => setPresence('turn'), ACT_BEFORE_TURN_MS);
    const talk = setTimeout(() => setPresence('talk'), ACT_BEFORE_TURN_MS + TURN_FRAME_MS * 4);
    return () => { clearTimeout(turn); clearTimeout(talk); };
  }, [allowed, telling, arrived]);
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
    walkTo(id);
    setTouchRequest(value => value + 1);
    setBubbleOpen(true);
  }
  function hear(place: TutorialPlace) {
    if (tour?.place === place) return;
    setTouchRequest(value => value + 1);
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
  const stationGlow = (id: ForgeStation) => glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === id || tour?.place === id ? [0.45, 0.75] : target === id || tour ? [0.30, 0.60] : [0.16, 0.48] });
  const sealsCover = position.y.interpolate({ inputRange: [SEALS_FRONT_Y - 0.005, SEALS_FRONT_Y], outputRange: [1, 0], extrapolate: 'clamp' });
  const seals = stations.find(station => station.id === 'seals')!;
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
  // Tutorial bubbles keep their bottom edge, so paging never moves the button under the finger.
  // On iPhone SE 3 the longest lines rise over Żaromir's legs. Text stays whole instead of scrolling under a shorter bubble.
  const bubbleTop = largeText || contentHeight === 0 ? preferredTop
    : tour ? Math.max(stationEdge, viewport.height - 20 - natural) : Math.min(preferredTop, Math.max(stationEdge, viewport.height - 20 - natural));
  const told = telling ? tour!.place : null;
  // Between chapters Żaromir waits at the last place facing the player. While the player chooses he points at the places.
  const pose: HeroPose = walking ? { kind: 'walk', direction }
    : told ? (presence === 'act' ? { kind: 'act', place: told } : presence === 'turn' ? { kind: 'turn' } : { kind: 'talk', gestures: [0, 3] })
    : !tour && isStation(arrived) ? { kind: 'act', place: arrived }
    : tour && !tour.place && arrived === 'tutor' ? { kind: 'talk', gestures: [0, 1, 0, 2] }
    : { kind: 'idle' };
  // The place responds once Żaromir stands there and starts working. Touching it again while he is there replays it.
  const effectPlace = arrived && arrived === target && (isStation(arrived) || (tour && arrived === 'door')) ? arrived as TutorialPlace : null;
  const bubbleHeight = Math.max(100, viewport.height - bubbleTop - 20);
  return <View style={styles.root} onLayout={({ nativeEvent }) => {
    const { width: nextWidth, height: nextHeight } = nativeEvent.layout;
    if (nextWidth > 0 && nextHeight > 0) setViewport({ width: nextWidth, height: nextHeight });
  }}>
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [viewport.width * 0.515, viewport.height * 0.45, 0], transform: [{ scale: camera.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scenery}>
      <Image source={room} resizeMode="stretch" style={{ position: 'absolute', left, top, width: sceneWidth, height: sceneHeight }} />
      <CandleFlames point={point} sceneWidth={sceneWidth} allowed={allowed} />
      <HearthFire anchor={point(0.515, 0.466)} size={sceneWidth * 0.17} opacity={0.8} />
      {stations.map(station => <Animated.Image source={haze} key={station.id} style={[styles.objectGlow, { ...point(station.x, station.y), opacity: stationGlow(station.id) }]} />)}
      <Animated.Image source={haze} style={[styles.doorGlow, { ...point(door.x, door.y), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === 'door' || tour?.place === 'door' ? [0.45, 0.72] : tour ? [0.30, 0.60] : [0.16, 0.48] }) }]} />
      {stations.map(station => {
        // The ember wisp floats above each station's touch area, where its mote used to be.
        const spot = hotspot(station.x, station.y);
        const lit = tour ? tour.place === station.id : target === station.id;
        return <SpriteLoop key={`wisp-${station.id}`} sheet={effectSheets.wisp} width={WISP} duration={1300} allowed={allowed}
          style={{ left: spot.left - WISP / 2, top: spot.top - 30 - WISP * 0.55 / effectSheets.wisp.aspect,
            opacity: lit ? 1 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
            transform: [{ translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />;
      })}
      {/* Native check: replaying on the same animated value made a stepped sheet blink on iOS. Each touch mounts a fresh response. */}
      {effectPlace && <StationEffect key={touchRequest} station={effectPlace} request={touchRequest} allowed={allowed} point={point} sceneWidth={sceneWidth} />}
    </View>
    <SceneHotspot label={placeLabel('door')} onPress={() => { if (tour) { hear('door'); return; } finishGuide(); onExit(); }} anchor={hotspot(door.x, door.y)} door allowed={allowed} glow={glow} heard={heardMark('door')} selected={tour ? tour.place === 'door' : undefined} />
    {stations.map(station => <SceneHotspot key={station.id} cue={false} label={placeLabel(station.id)} hint={tour ? undefined : t('room.inspect')} selected={tour ? tour.place === station.id : target === station.id}
      onPress={() => tour ? hear(station.id) : choose(station.id)} anchor={hotspot(station.x, station.y)} allowed={allowed} glow={glow} heard={heardMark(station.id)} />)}
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.hero, { left, top, transform: [
      { translateX: position.x.interpolate({ inputRange: [0, 1], outputRange: [-FIGURE_WIDTH / 2, sceneWidth - FIGURE_WIDTH / 2] }) },
      { translateY: position.y.interpolate({ inputRange: [0, 1], outputRange: [-FIGURE_HEIGHT * FIGURE_FOOT, sceneHeight - FIGURE_HEIGHT * FIGURE_FOOT] }) },
    ] }]}>
      <View style={styles.heroShadow} />
      <HeroSprite run={hero.run} pose={pose} allowed={allowed} height={FIGURE_HEIGHT} scale={hero.scale} />
    </Animated.View>
    <Animated.Image source={sealsFront} resizeMode="stretch" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.front, { ...point(SEALS_BOX.x, SEALS_BOX.y), width: SEALS_BOX.width * sceneWidth, height: SEALS_BOX.height * sceneHeight, opacity: sealsCover }]} />
    {/* Native check: the cut hid the seal glow, so the seals darkened as he stepped behind them. The glow is repeated over the cut. */}
    <Animated.Image source={haze} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.objectGlow, styles.front, { ...point(seals.x, seals.y), opacity: Animated.multiply(stationGlow('seals'), sealsCover) }]} />
    </Animated.View>
    {(guidePlace || (tour && (telling || !tour.place)) || placeBubble) && <RoomBubble
      frame={{ left: centered ? (viewport.width - bubbleWidth) / 2 : bubbleLeft, top: bubbleTop, width: bubbleWidth, maxHeight: bubbleHeight, height: largeText ? bubbleHeight : undefined }}
      reveal={centered ? null : bubble} pointX={centered ? centeredX : foot!.x} fill={largeText}
      contentKey={`${guidePlace ?? (tour ? `tour-${tour.place}-${tour.line}-${tour.ended}` : arrived)}-${i18n.language}-${fontScale}`}
      onContentHeight={setContentHeight} dismissLabel={t(guidePlace ? 'room.guide.skip' : tour ? 'room.tutorial.close' : 'room.dismiss')}
      onDismiss={() => guidePlace ? finishGuide() : tour ? endTour() : setBubbleOpen(false)} footer={footer}>
      {!guidePlace && !tour && isStation(arrived) && <Text accessibilityRole="header" maxFontSizeMultiplier={2.4} style={styles.detailTitle}>{t(`room.${arrived}`)}</Text>}
      <Text maxFontSizeMultiplier={2} style={styles.description}>{bindShortWords(guidePlace ? t(`room.guide.${guidePlace}`)
        : tour ? t(tourTextKey(tour))
        : t(`room.descriptions.${arrived}`), i18n.language)}</Text>
      {!guidePlace && !tour && isStation(arrived) && <Pressable accessibilityRole="button" accessibilityLabel={t(`room.actions.${arrived}`)} onPress={() => onOpenStation(arrived)} style={({ pressed }) => [styles.stationAction, { opacity: pressed ? 0.6 : 1 }]}>
        <Text maxFontSizeMultiplier={2} style={styles.actionLabel}>{t(`room.actions.${arrived}`)} <Text accessibilityElementsHidden>→</Text></Text>
      </Pressable>}
    </RoomBubble>}
  </View>;
}

const styles = StyleSheet.create({
  stationAction: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  actionLabel: { color: '#5d3616', fontSize: 17, fontWeight: '600' },
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#111719' },
  scenery: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  objectGlow: { position: 'absolute', width: 180, height: 160, marginLeft: -90, marginTop: -85 },
  doorGlow: { position: 'absolute', width: 130, height: 180, marginLeft: -65, marginTop: -95, tintColor: '#bfe8f0' },
  hero: { position: 'absolute', width: FIGURE_WIDTH, height: FIGURE_HEIGHT, zIndex: 3 },
  front: { position: 'absolute', zIndex: 4, pointerEvents: 'none' },
  heroShadow: { position: 'absolute', width: 76, height: 18, top: FIGURE_HEIGHT * FIGURE_FOOT - 10, left: FIGURE_WIDTH / 2 - 38, experimental_backgroundImage: 'radial-gradient(ellipse closest-side at center, rgba(4,6,6,0.62) 0%, rgba(4,6,6,0.35) 55%, rgba(4,6,6,0) 100%)' },
  detailTitle: { flexShrink: 0, color: '#47311e', fontFamily: tokens.font.display, fontSize: 19, fontWeight: '400' },
  description: { flexShrink: 0, color: '#523c29', fontFamily: tokens.font.body, fontSize: 16, lineHeight: 23, marginTop: 5 },
});
