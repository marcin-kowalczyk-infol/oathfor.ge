import { Fragment, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useMotionAllowed } from '../ui/useMotion';
import { StationEffect } from './StationEffect';
import { SceneHotspot } from './SceneHotspot';
import { DialoguePanel, type PanelControls } from './DialoguePanel';
import { chapterScript, guideScript, visitScript, type ScriptLine } from './conversation';
import { presetArt } from '../characters/presetArt';
import { advanceTour, freshTour, hearPlace, tourControl, tourTextKey, type Tour, type TutorialPlace } from './tutorialChapters';
import { HearthFire } from '../ui/HearthFire';
import { HeroSprite, ACT_BEFORE_TURN_MS, TURN_FRAME_MS, type HeroPose } from './HeroSprite';
import { CandleFlames } from './CandleFlames';
import { SpriteLoop } from './Sprite';
import { effectSheets } from './motion';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { aside, FIGURE_FOOT, FIGURE_HEIGHT, FIGURE_WIDTH, places, playerStart, SEALS_BOX, SEALS_FRONT_Y, tutor, type ScenePlace, type Spot } from './sceneLayout';
import { PlayerFigure } from './PlayerFigure';
import type { Character } from '../api/characters';
import { useWalker } from './useWalker';

export type ForgeStation = 'hearth' | 'seals' | 'chronicle';
const stations: { id: ForgeStation; x: number; y: number }[] = [
  { id: 'hearth', ...places.hearth.anchor },
  { id: 'seals', ...places.seals.anchor },
  { id: 'chronicle', ...places.chronicle.anchor },
];
const room = require('../../assets/forge/room-prototype-v03.png');
const sealsFront = require('../../assets/forge/motion/room-seals-front-v01.png');
const haze = require('../../assets/forge/ember-haze-v01.png');
const WISP = 22;
const ORDER_CHECK_MS = 100;
const PANEL_BOTTOM = 20;
const RING = { width: 84, height: 24 };
const door = places.door.anchor;
// Where Żaromir stands: beside each place for the tutorial, in front of the hearth while the player chooses, and aside in normal mode.
// Native check on iPhone 18 Pro: from the start point he stood behind the tutorial bubble.
type GuideSpot = TutorialPlace | 'aside' | 'tutor';
const guideFeet: Record<GuideSpot, Spot> = {
  hearth: places.hearth.guide, seals: places.seals.guide, chronicle: places.chronicle.guide, door: places.door.guide, tutor, aside,
};
type PlayerSpot = ScenePlace | 'start';
const playerFeet: Record<PlayerSpot, Spot> = {
  hearth: places.hearth.player, seals: places.seals.player, chronicle: places.chronicle.player, door: places.door.player, start: playerStart,
};
const isStation = (spot: string | null): spot is ForgeStation => stations.some(station => station.id === spot);
/** Below the seal drums' front edge a figure is in front of them, so the cut drawn after it no longer covers it. */
const sealsCover = (position: Animated.ValueXY) => position.y.interpolate({ inputRange: [SEALS_FRONT_Y - 0.005, SEALS_FRONT_Y], outputRange: [1, 0], extrapolate: 'clamp' });

/**
 * The Forge room entrance: visiting a station never mutates an Oath, only its named action leaves the room.
 * showGuide starts the four-step guide. A later change to a new truthy value (true or a restart id) starts it again.
 * tutorial starts the rules conversation, and a new id restarts it with no heard places. It takes priority over the guide.
 * onTutorialEnd reports a close or finish, so the parent can drop the id and a remount does not start it again.
 */
export function ForgeRoom({ character, showGuide = false, onGuideComplete, tutorial = null, onTutorialStart, onTutorialEnd, onOpenStation, onExit }: {
  character: Pick<Character, 'name' | 'presetId' | 'build' | 'form'>; showGuide?: boolean | number; onGuideComplete?: () => void; tutorial?: number | null; onTutorialStart?: () => void; onTutorialEnd?: () => void;
  onOpenStation: (station: ForgeStation) => void; onExit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { width, height } = useWindowDimensions();
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
  // Żaromir stands aside in normal mode. The player starts in the lower middle and walks to each touched place.
  const guide = useWalker(guideFeet, aside, allowed);
  const player = useWalker(playerFeet, playerStart, allowed);
  // Which figure is lower on screen, so drawn in front. Walks cannot be read back, so it is checked at a coarse rate while one walks.
  const lower = (): 'guide' | 'player' => guide.now().y > player.now().y ? 'guide' : 'player';
  const [front, setFront] = useState(lower);
  useEffect(() => {
    setFront(lower());
    if (!allowed || !(guide.walking || player.walking)) return;
    const checks = setInterval(() => setFront(lower()), ORDER_CHECK_MS);
    return () => clearInterval(checks);
  }, [allowed, guide.walking, player.walking, guide.run, player.run]);
  const [zoomed, setZoomed] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  // The line shown in a place visit (0 the player's, 1 Żaromir's) and whether a chapter still shows the player's opening line.
  const [visitLine, setVisitLine] = useState(0);
  const [opening, setOpening] = useState(false);
  const [guideStep, setGuideStep] = useState<number | null>(() => showGuide && !tutorial ? 0 : null);
  const [tour, setTour] = useState<Tour | null>(() => tutorial ? freshTour : null);
  const tutorialRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!tutorial || tutorialRequest.current === tutorial) return;
    tutorialRequest.current = tutorial;
    setTour(freshTour); setGuideStep(null); setBubbleOpen(false);
    // Żaromir walks into the room from the start point to talk, above the bubble.
    guide.walkTo('tutor');
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
    guide.walkTo('aside');
    onGuideComplete?.();
  }
  // Local decision D3 (owner, 2026-09-28): in the guide only Żaromir walks, to his spot beside each step's place.
  useEffect(() => { if (guidePlace) guide.walkTo(guidePlace); }, [guidePlace]);
  const camera = useRef(new Animated.Value(0)).current;
  const entered = useRef(false);
  const [touchRequest, setTouchRequest] = useState(0);
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!allowed) { camera.setValue(entered.current ? 1 : 0); return; }
    if (entered.current) { camera.setValue(1); return; }
    entered.current = true;
    setZoomed(true);
    const approach = Animated.timing(camera, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), isInteraction: false, useNativeDriver: true });
    approach.start();
    return () => approach.stop();
  }, [allowed, camera]);

  // A chapter starts once both figures stand at the chosen place.
  const telling = !!tour?.place && guide.arrived === tour.place && player.arrived === tour.place;
  // At a told place he first works facing it, then turns around and talks. Reduced motion keeps the facing pose.
  const [presence, setPresence] = useState<'act' | 'turn' | 'talk'>('act');
  useEffect(() => {
    setPresence('act');
    if (!telling || !allowed) return;
    const turn = setTimeout(() => setPresence('turn'), ACT_BEFORE_TURN_MS);
    const talk = setTimeout(() => setPresence('talk'), ACT_BEFORE_TURN_MS + TURN_FRAME_MS * 4);
    return () => { clearTimeout(turn); clearTimeout(talk); };
  }, [allowed, telling, guide.arrived]);
  const placeBubble = !tour && bubbleOpen && isStation(player.arrived);

  useEffect(() => {
    if (!allowed) { glow.setValue(0.35); return; }
    const shimmer = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, isInteraction: false, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2100, isInteraction: false, useNativeDriver: true }),
    ]));
    shimmer.start();
    return () => { shimmer.stop(); glow.stopAnimation(); };
  }, [allowed, glow]);

  function choose(id: ForgeStation) {
    finishGuide();
    player.walkTo(id);
    setTouchRequest(value => value + 1);
    setBubbleOpen(true);
    setVisitLine(0);
  }
  function hear(place: TutorialPlace) {
    if (tour?.place === place) return;
    setTouchRequest(value => value + 1);
    setTour(current => current && hearPlace(current, place));
    setOpening(true);
    guide.walkTo(place);
    player.walkTo(place);
  }
  const control = tour && telling ? tourControl(tour) : null;
  function endTour() {
    setTour(null);
    // Normal mode: Żaromir stands aside again.
    guide.walkTo('aside');
    onTutorialEnd?.();
  }
  function advance() {
    setTour(current => current && advanceTour(current));
  }
  const placeLabel = (place: TutorialPlace) => tour
    ? `${t('room.tutorial.hear', { place: t(`room.${place}`) })}${tour.heard.includes(place) ? `, ${t('room.tutorial.heard')}` : ''}`
    : t(place === 'door' ? 'room.exit' : `room.${place}`);
  const heardMark = (place: TutorialPlace) => tour?.heard.includes(place) ? `heard-${place}` : undefined;
  const stationGlow = (id: ForgeStation) => glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === id || tour?.place === id ? [0.45, 0.75] : player.target === id || tour ? [0.30, 0.60] : [0.16, 0.48] });
  const seals = stations.find(station => station.id === 'seals')!;
  // The panel and the ring sit relative to the camera zoom, so scene points are projected through it.
  const zoom = zoomed ? 1.08 : 1;
  const stationEdge = Math.max(...stations.map(station => viewport.height * 0.45 + (hotspot(station.x, station.y).top + 36 - viewport.height * 0.45) * zoom));
  const told = telling ? tour!.place : null;
  // Between chapters Żaromir waits at the last place facing the player. While the player chooses he points at the places.
  const pose: HeroPose = guide.walking ? { kind: 'walk', direction: guide.direction }
    : told ? (presence === 'act' ? { kind: 'act', place: told } : presence === 'turn' ? { kind: 'turn' } : { kind: 'talk', gestures: [0, 3] })
    : tour && !tour.place && guide.arrived === 'tutor' ? { kind: 'talk', gestures: [0, 1, 0, 2] }
    : guidePlace && guide.arrived === guidePlace ? { kind: 'talk', gestures: [0, 3] }
    : { kind: 'idle' };
  // At a visited place the player handles it, facing it.
  const playerPose: HeroPose = player.walking ? { kind: 'walk', direction: player.direction }
    : told ? { kind: 'act', place: told }
    : !tour && isStation(player.arrived) ? { kind: 'act', place: player.arrived } : { kind: 'idle' };
  // The place responds once the figure stands there and starts working. Touching it again while it is there replays it.
  const effectPlace = tour ? told : player.arrived === player.target && isStation(player.arrived) ? player.arrived : null;
  // Lower on screen is drawn in front. Each figure brings its own seal cut, so the drums cover only a figure behind them.
  const figures = ([
    { id: 'guide', walker: guide, node: <HeroSprite run={guide.run} pose={pose} allowed={allowed} height={FIGURE_HEIGHT} scale={guide.scale} /> },
    { id: 'player', walker: player, node: <PlayerFigure presetId={character.presetId} build={character.build} run={player.run} pose={playerPose} allowed={allowed} scale={player.scale} /> },
  ] as const).slice().sort((one, two) => one.id === front ? 1 : two.id === front ? -1 : 0);
  // What the panel says now: the guide step, the tutorial choice or chapter, or the visited place.
  const form = character.form;
  let line: (ScriptLine & { id: string; title?: string; more?: boolean; controls?: PanelControls; next?: () => void; dismiss: () => void }) | null = null;
  if (guidePlace) {
    const last = guideStep === 3;
    line = { ...guideScript(guidePlace)[0], id: `guide-${guideStep}`, dismiss: finishGuide, next: last ? undefined : () => setGuideStep(value => value! + 1),
      controls: { step: { count: `${guideStep! + 1} / 4`, label: t(last ? 'room.guide.done' : 'room.guide.next'), mark: last ? '✓' : '→', onPress: () => last ? finishGuide() : setGuideStep(value => value! + 1) } } };
  } else if (tour && (telling || !tour.place)) {
    const script = told ? chapterScript(told, form) : null;
    if (script && opening) line = { ...script[0], id: `tour-${told}-open`, more: true, next: () => setOpening(false), dismiss: endTour };
    else if (script && control) line = { ...script[control.line], id: `tour-${told}-${control.line}`, dismiss: endTour, next: control.action === 'next' ? advance : undefined,
      controls: { step: { count: `${control.line} / ${control.lines}`, label: t(`room.tutorial.${control.action}`), mark: '→', text: control.action !== 'next', onPress: advance } } };
    else line = { speaker: 'guide', key: tourTextKey(tour), id: `tour-${tourTextKey(tour)}`, dismiss: endTour,
      controls: tour.ended ? { step: { count: '', label: t('room.tutorial.finish'), text: true, onPress: endTour } } : undefined };
  } else if (placeBubble) {
    const place = player.arrived as ForgeStation;
    const script = visitScript(place, form);
    const said = script[visitLine] as ScriptLine;
    line = visitLine === 0 ? { ...said, id: `visit-${touchRequest}-0`, more: true, next: () => setVisitLine(1), dismiss: () => setBubbleOpen(false) }
      : { ...said, id: `visit-${touchRequest}-1`, title: t(`room.${place}`), dismiss: () => setBubbleOpen(false),
        controls: { action: { label: t(`room.actions.${place}`), onPress: () => onOpenStation(place) } } };
  }
  // A soft ring of light under the speaking figure shows who speaks. It waits while that figure walks.
  const speaker = line?.speaker === 'player' ? player : guide;
  const speakerFoot = line && !speaker.walking ? speaker.now() : null;
  const panelWidth = Math.min(viewport.width - 32, 420);
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
        const lit = tour ? tour.place === station.id : player.target === station.id;
        return <SpriteLoop key={`wisp-${station.id}`} sheet={effectSheets.wisp} width={WISP} duration={1300} allowed={allowed}
          style={{ left: spot.left - WISP / 2, top: spot.top - 30 - WISP * 0.55 / effectSheets.wisp.aspect,
            opacity: lit ? 1 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
            transform: [{ translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />;
      })}
      {/* Native check: replaying on the same animated value made a stepped sheet blink on iOS. Each touch mounts a fresh response. */}
      {effectPlace && <StationEffect key={touchRequest} station={effectPlace} request={touchRequest} allowed={allowed} point={point} sceneWidth={sceneWidth} />}
    </View>
    <SceneHotspot label={placeLabel('door')} onPress={() => { if (tour) { hear('door'); return; } finishGuide(); onExit(); }} anchor={hotspot(door.x, door.y)} door allowed={allowed} glow={glow} heard={heardMark('door')} selected={tour ? tour.place === 'door' : undefined} />
    {stations.map(station => <SceneHotspot key={station.id} cue={false} label={placeLabel(station.id)} hint={tour ? undefined : t('room.inspect')} selected={tour ? tour.place === station.id : player.target === station.id}
      onPress={() => tour ? hear(station.id) : choose(station.id)} anchor={hotspot(station.x, station.y)} allowed={allowed} glow={glow} heard={heardMark(station.id)} />)}
    {speakerFoot && <View testID="speaking-ring" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { left: point(speakerFoot.x, speakerFoot.y).left - RING.width / 2, top: point(speakerFoot.x, speakerFoot.y).top - RING.height / 2 }]} />}
    {figures.map(({ id, walker, node }) => <Fragment key={id}>
      <Animated.View testID={`room-${id}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.figure, { left, top, transform: [
        { translateX: walker.position.x.interpolate({ inputRange: [0, 1], outputRange: [-FIGURE_WIDTH / 2, sceneWidth - FIGURE_WIDTH / 2] }) },
        { translateY: walker.position.y.interpolate({ inputRange: [0, 1], outputRange: [-FIGURE_HEIGHT * FIGURE_FOOT, sceneHeight - FIGURE_HEIGHT * FIGURE_FOOT] }) },
      ] }]}>
        <View style={styles.figureShadow} />
        {node}
      </Animated.View>
      <Animated.Image testID={`seals-cut-${id}`} source={sealsFront} resizeMode="stretch" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[styles.front, { ...point(SEALS_BOX.x, SEALS_BOX.y), width: SEALS_BOX.width * sceneWidth, height: SEALS_BOX.height * sceneHeight, opacity: sealsCover(walker.position) }]} />
      {/* Native check: the cut hid the seal glow, so the seals darkened as he stepped behind them. The glow is repeated over the cut. */}
      <Animated.Image source={haze} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.objectGlow, styles.front, { ...point(seals.x, seals.y), opacity: Animated.multiply(stationGlow('seals'), sealsCover(walker.position)) }]} />
    </Fragment>)}
    </Animated.View>
    {line && <DialoguePanel frame={{ left: (viewport.width - panelWidth) / 2, width: panelWidth, bottom: PANEL_BOTTOM, maxHeight: viewport.height - PANEL_BOTTOM - stationEdge }}
      speaker={line.speaker} lineId={line.id} text={bindShortWords(t(line.key, line.values), i18n.language)} title={line.title}
      playerName={character.name} portrait={presetArt(character.presetId, character.build)?.portrait ?? null} allowed={allowed} more={!!line.more}
      continueLabel={t('room.tutorial.next')} onContinue={() => line?.next?.()} controls={line.controls}
      dismissLabel={t(guidePlace ? 'room.guide.skip' : tour ? 'room.tutorial.close' : 'room.dismiss')} onDismiss={line.dismiss} />}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#111719' },
  scenery: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  objectGlow: { position: 'absolute', width: 180, height: 160, marginLeft: -90, marginTop: -85 },
  doorGlow: { position: 'absolute', width: 130, height: 180, marginLeft: -65, marginTop: -95, tintColor: '#bfe8f0' },
  // Figures and seal cuts share one layer above the touch areas, so their tree order is the drawing order.
  figure: { position: 'absolute', width: FIGURE_WIDTH, height: FIGURE_HEIGHT, zIndex: 3 },
  front: { position: 'absolute', zIndex: 3, pointerEvents: 'none' },
  figureShadow: { position: 'absolute', width: 76, height: 18, top: FIGURE_HEIGHT * FIGURE_FOOT - 10, left: FIGURE_WIDTH / 2 - 38, experimental_backgroundImage: 'radial-gradient(ellipse closest-side at center, rgba(4,6,6,0.62) 0%, rgba(4,6,6,0.35) 55%, rgba(4,6,6,0) 100%)' },
  ring: { position: 'absolute', zIndex: 3, width: RING.width, height: RING.height, borderRadius: RING.height / 2,
    experimental_backgroundImage: 'radial-gradient(ellipse closest-side at center, rgba(255,196,110,0.55) 0%, rgba(255,170,80,0.22) 60%, rgba(255,170,80,0) 100%)' },
});
