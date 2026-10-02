import { Fragment, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, SafeAreaView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useMotionAllowed } from '../ui/useMotion';
import { StationEffect } from './StationEffect';
import { SceneHotspot } from './SceneHotspot';
import { DialoguePanel, type PanelControls } from './DialoguePanel';
import { TalkCounters } from './TalkCounters';
import { progressHint, type ForgeProgress } from './progressHint';
import { chapterScript, guideScript, visitScript, type ScriptLine } from './conversation';
import { useArt } from '../art/ArtProvider';
import { presetArt } from '../characters/presetArt';
import { advanceTour, freshTour, hearPlace, tourControl, tourTextKey, type Tour, type TutorialPlace } from './tutorialChapters';
import { HearthFire } from '../ui/HearthFire';
import { HeroSprite, ACT_BEFORE_TURN_MS, TURN_FRAME_MS, type HeroPose } from './HeroSprite';
import { CandleFlames } from './CandleFlames';
import { SpriteLoop } from './Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { ARTWORK, aside, FIGURE_FOOT, FIGURE_HEIGHT, FIGURE_WIDTH, places, playerStart, SEALS_FRONT_Y, tutor, type ScenePlace, type Spot } from './sceneLayout';
import { PlayerFigure } from './PlayerFigure';
import type { Character } from '../api/characters';
import { useWalker } from './useWalker';
import { useCameraFlight } from './cameraFlight';
import { Text } from '../ui/Text';
import { tokens } from '../ui/tokens';

export type ForgeStation = 'hearth' | 'seals' | 'chronicle';
const stations: { id: ForgeStation; x: number; y: number }[] = [
  { id: 'hearth', ...places.hearth.anchor },
  { id: 'seals', ...places.seals.anchor },
  { id: 'chronicle', ...places.chronicle.anchor },
];
const WISP = 22;
const ORDER_CHECK_MS = 100;
const PANEL_BOTTOM = 20;
const HINT_WAIT_MS = 2000;
// The menu plate's offset inside the safe area. The room exists only up to text scale 1.3 (layoutMode), so its label grows no further.
const PLATE_INSET = { left: 16, top: 12 };
const PLATE_SCALE = 1.3;
// Żaromir's touch target aside, around his body above the feet.
// Kept narrow so it never covers the hearth or chronicle touch areas on 375 point wide screens.
const TALK_TARGET = { width: 44, height: 88 };
// SceneHotspot's station touch area.
const STATION_TARGET = { width: 76, height: 72 };
const RING = { width: 110, height: 34 };
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
export function ForgeRoom({ character, progress, onTalk, from = null, onReturned, showGuide = false, onGuideComplete, tutorial = null, onTutorialStart, onTutorialEnd, onOpenStation, onExit }: {
  character: Pick<Character, 'name' | 'presetId' | 'build' | 'form'>;
  /** Server counts for Żaromir's hint and counters. onTalk asks the parent to refresh them. */
  progress: ForgeProgress; onTalk: () => void;
  /** The place a return from its screen flies back out of. The player stands there. */
  from?: ForgeStation | null; onReturned?: () => void; showGuide?: boolean | number; onGuideComplete?: () => void; tutorial?: number | null; onTutorialStart?: () => void; onTutorialEnd?: () => void;
  onOpenStation: (station: ForgeStation) => void; onExit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const art = useArt();
  const { haze, room } = art;
  // The seal drums cut from the style's room, drawn over a figure standing behind them in the doorway. A room without the cut has none.
  const sealsFront = room.sealsFront;
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
  const player = useWalker(playerFeet, from ? playerFeet[from] : playerStart, allowed);
  const flight = useCameraFlight({ allowed, from, onReturned });
  // While the camera flies, every other touch in the room is ignored.
  const still = <Args extends unknown[]>(handler: (...args: Args) => void) => (...args: Args) => { if (!flight.busy) handler(...args); };
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
  // Talking to Żaromir (owner decisions D4 to D6, 2026-09-28): one touch, and he answers with one hint line.
  // A known Today answer lets him speak at once. Otherwise he waits for the refresh the touch started, at most HINT_WAIT_MS.
  // Once he speaks the hint follows the counts, so it never contradicts the counters. It types again only when it changes.
  const [talk, setTalk] = useState<{ id: number; spoken: boolean; refreshing: boolean } | null>(null);
  useEffect(() => {
    if (!talk || talk.spoken) return;
    if (progress.today) setTalk(current => current && { ...current, spoken: true });
    else if (progress.loading) { if (!talk.refreshing) setTalk(current => current && { ...current, refreshing: true }); }
    else if (talk.refreshing) setTalk(current => current && { ...current, spoken: true });
  }, [talk, progress]);
  const waitingTalk = talk && !talk.spoken ? talk.id : null;
  useEffect(() => {
    if (waitingTalk === null) return;
    const limit = setTimeout(() => setTalk(current => current && { ...current, spoken: true }), HINT_WAIT_MS);
    return () => clearTimeout(limit);
  }, [waitingTalk]);
  const [guideStep, setGuideStep] = useState<number | null>(() => showGuide && !tutorial ? 0 : null);
  const [tour, setTour] = useState<Tour | null>(() => tutorial ? freshTour : null);
  const tutorialRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!tutorial || tutorialRequest.current === tutorial) return;
    tutorialRequest.current = tutorial;
    setTour(freshTour); setGuideStep(null); setBubbleOpen(false); setTalk(null);
    // Żaromir walks into the room from the start point to talk, above the bubble.
    guide.walkTo('tutor');
    onTutorialStart?.();
  }, [tutorial]);
  const guideRequest = useRef(showGuide);
  useEffect(() => {
    if (guideRequest.current === showGuide) return;
    guideRequest.current = showGuide;
    // A restart replaces whatever station the player had open, so its bubble never returns after the guide.
    if (showGuide && !tour) { setGuideStep(0); setBubbleOpen(false); setTalk(null); }
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
    // A return from a place flies back instead, so the entrance zoom does not play on top of it.
    if (from) entered.current = true;
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
  const visited = player.arrived && player.arrived !== 'start' ? player.arrived : null;
  const placeBubble = !tour && bubbleOpen && !!visited;

  useEffect(() => {
    if (!allowed) { glow.setValue(0.35); return; }
    const shimmer = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, isInteraction: false, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2100, isInteraction: false, useNativeDriver: true }),
    ]));
    shimmer.start();
    return () => { shimmer.stop(); glow.stopAnimation(); };
  }, [allowed, glow]);

  function choose(id: ScenePlace) {
    finishGuide();
    player.walkTo(id);
    setTouchRequest(value => value + 1);
    setBubbleOpen(true);
    setTalk(null);
    setVisitLine(0);
  }
  // MVP-22-B3 (owner decision, 2026-10-02): the plate leaves like the door's action, and like touching the door it ends the guide.
  function leaveToMenu() {
    finishGuide();
    flight.fly('door', onExit);
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
    : t(`room.${place}`);
  const heardMark = (place: TutorialPlace) => tour?.heard.includes(place) ? { testID: `heard-${place}`, label: t('room.tutorial.heardMark') } : undefined;
  const stationGlow = (id: ForgeStation) => glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === id || tour?.place === id ? [0.45, 0.75] : player.target === id || tour ? [0.30, 0.60] : [0.16, 0.48] });
  const seals = stations.find(station => station.id === 'seals')!;
  // The panel and the ring sit relative to the camera zoom, so scene points are projected through it.
  const zoom = zoomed ? 1.08 : 1;
  // A scene point as the room camera shows it, so the flight zooms around the object where the player sees it.
  const onScreen = (spot: Spot) => ({ left: viewport.width * 0.515 + (left + spot.x * sceneWidth - viewport.width * 0.515) * zoom,
    top: viewport.height * 0.45 + (top + spot.y * sceneHeight - viewport.height * 0.45) * zoom });
  const stationEdge = Math.max(...stations.map(station => viewport.height * 0.45 + (hotspot(station.x, station.y).top + 36 - viewport.height * 0.45) * zoom));
  const told = telling ? tour!.place : null;
  // Between chapters Żaromir waits at the last place facing the player. While the player chooses he points at the places.
  const pose: HeroPose = guide.walking ? { kind: 'walk', direction: guide.direction }
    : told ? (presence === 'act' ? { kind: 'act', place: told } : presence === 'turn' ? { kind: 'turn' } : { kind: 'talk', gestures: [0, 3] })
    // Arriving before the player, he already faces the place, so he does not turn back to it when the chapter starts (native check, 2026-09-30).
    : tour?.place && guide.arrived === tour.place ? { kind: 'act', place: tour.place }
    : tour && !tour.place && guide.arrived === 'tutor' ? { kind: 'talk', gestures: [0, 1, 0, 2] }
    : guidePlace && guide.arrived === guidePlace ? { kind: 'talk', gestures: [0, 3] }
    : talk && !guide.walking ? { kind: 'talk', gestures: [0, 3] }
    : { kind: 'idle' };
  // At a visited place the player handles it, facing it.
  const playerPose: HeroPose = player.walking ? { kind: 'walk', direction: player.direction }
    : told ? { kind: 'act', place: told }
    : !tour && visited ? { kind: 'act', place: visited } : { kind: 'idle' };
  // The place responds once the figure stands there and starts working. Touching it again while it is there replays it.
  const effectPlace = tour ? told : player.arrived === player.target ? visited : null;
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
      // MVP-22-A5: the step control shows its words ("Następne miejsce", "Zacznij odkrywać"), not a bare arrow or check.
      controls: { step: { count: `${guideStep! + 1} / 4`, label: t(last ? 'room.guide.done' : 'room.guide.next'), text: true, onPress: () => last ? finishGuide() : setGuideStep(value => value! + 1) } } };
  } else if (tour && (telling || !tour.place)) {
    const script = told ? chapterScript(told, form) : null;
    if (script && opening) line = { ...script[0], id: `tour-${told}-open`, more: true, next: () => setOpening(false), dismiss: endTour };
    else if (script && control) line = { ...script[control.line], id: `tour-${told}-${control.line}`, dismiss: endTour, next: control.action === 'next' ? advance : undefined,
      controls: { step: { count: `${control.line} / ${control.lines}`, label: t(`room.tutorial.${control.action}`), mark: '→', text: control.action !== 'next', onPress: advance } } };
    else line = { speaker: 'guide', key: tourTextKey(tour), id: `tour-${tourTextKey(tour)}`, dismiss: endTour,
      controls: tour.ended ? { step: { count: '', label: t('room.tutorial.finish'), text: true, onPress: endTour } } : undefined };
  } else if (talk) {
    // An empty line while Żaromir waits for the counts. The hint then types once.
    line = { speaker: 'guide', key: talk.spoken ? progressHint(progress).key : '', id: `talk-${talk.id}`, dismiss: () => setTalk(null) };
  } else if (placeBubble) {
    const place = visited!;
    const script = visitScript(place, form);
    const said = script[visitLine] as ScriptLine;
    // The action flies the camera into the place, or pulls it back out of the door, before its screen opens.
    const action = place === 'door' ? { label: t('room.exit'), onPress: () => flight.fly('door', onExit) }
      : { label: t(`room.actions.${place}`), onPress: () => flight.fly(place, () => onOpenStation(place)) };
    line = visitLine === 0 ? { ...said, id: `visit-${touchRequest}-0`, more: true, next: () => setVisitLine(1), dismiss: () => setBubbleOpen(false) }
      : { ...said, id: `visit-${touchRequest}-1`, title: t(`room.${place}`), dismiss: () => setBubbleOpen(false), controls: { action } };
  }
  // A soft ring of light under the speaking figure shows who speaks. It waits while that figure walks.
  const speaker = line?.speaker === 'player' ? player : guide;
  const speakerFoot = line && !speaker.walking ? speaker.now() : null;
  const panelWidth = Math.min(viewport.width - 32, 420);
  // Żaromir's touch target covers his body, but starts below any station touch area above him, so the places keep their full targets.
  const asidePoint = point(aside.x, aside.y);
  const talkLeft = asidePoint.left - TALK_TARGET.width / 2;
  const talkTop = Math.max(asidePoint.top - TALK_TARGET.height, ...stations.map(station => {
    const spot = hotspot(station.x, station.y);
    return spot.left - STATION_TARGET.width / 2 < talkLeft + TALK_TARGET.width && talkLeft < spot.left + STATION_TARGET.width / 2 ? spot.top + STATION_TARGET.height / 2 : -Infinity;
  }));
  const talkBox = { left: talkLeft, top: talkTop, width: TALK_TARGET.width, height: Math.max(44, asidePoint.top + 10 - talkTop) };
  return <View style={styles.root} onLayout={({ nativeEvent }) => {
    const { width: nextWidth, height: nextHeight } = nativeEvent.layout;
    if (nextWidth > 0 && nextHeight > 0) setViewport({ width: nextWidth, height: nextHeight });
  }}>
    <Animated.View testID="flight-camera" style={[StyleSheet.absoluteFill, flight.place && flight.scale(onScreen(places[flight.place].anchor))]}>
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [viewport.width * 0.515, viewport.height * 0.45, 0], transform: [{ scale: camera.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scenery}>
      <Image testID="forge-room-image" source={room.image} resizeMode="stretch" style={{ position: 'absolute', left, top, width: sceneWidth, height: sceneHeight }} />
      <CandleFlames point={point} sceneWidth={sceneWidth} allowed={allowed} />
      <HearthFire anchor={point(0.515, 0.466)} size={sceneWidth * 0.17} opacity={0.8} />
      {/* Native check: replaying on the same animated value made a stepped sheet blink on iOS. Each touch mounts a fresh response. */}
      {/* Native check: drawn over the glows, the turning drums lost their glow and brightened when they stopped. The response lies under them. */}
      {effectPlace && <StationEffect key={touchRequest} station={effectPlace} request={touchRequest} allowed={allowed} point={point} sceneWidth={sceneWidth} />}
      {stations.map(station => <Animated.Image testID={`station-glow-${station.id}`} source={haze} key={station.id} style={[styles.objectGlow, { ...point(station.x, station.y), opacity: stationGlow(station.id) }]} />)}
      <Animated.Image source={haze} style={[styles.doorGlow, { ...point(door.x, door.y), opacity: glow.interpolate({ inputRange: [0, 1], outputRange: guidePlace === 'door' || tour?.place === 'door' ? [0.45, 0.72] : tour ? [0.30, 0.60] : [0.16, 0.48] }) }]} />
      {stations.map(station => {
        // The ember wisp floats above each station's touch area, where its mote used to be.
        const spot = hotspot(station.x, station.y);
        const lit = tour ? tour.place === station.id : player.target === station.id;
        return <SpriteLoop key={`wisp-${station.id}`} sheet={art.effects.wisp} width={WISP} duration={1300} allowed={allowed}
          style={{ left: spot.left - WISP / 2, top: spot.top - 30 - WISP * 0.55 / art.effects.wisp.aspect,
            opacity: lit ? 1 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
            transform: [{ translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />;
      })}
    </View>
    <SceneHotspot label={placeLabel('door')} onPress={still(() => tour ? hear('door') : choose('door'))} hint={tour ? undefined : t('room.inspect')} anchor={hotspot(door.x, door.y)} door allowed={allowed} glow={glow} heard={heardMark('door')} selected={tour ? tour.place === 'door' : player.target === 'door'} />
    {stations.map(station => <SceneHotspot key={station.id} cue={false} label={placeLabel(station.id)} hint={tour ? undefined : t('room.inspect')} selected={tour ? tour.place === station.id : player.target === station.id}
      onPress={still(() => tour ? hear(station.id) : choose(station.id))} anchor={hotspot(station.x, station.y)} allowed={allowed} glow={glow} heard={heardMark(station.id)} />)}
    {/* Native check on iPhone 18 Pro (MVP-20-T15): a gradient ring was invisible on the lit floor. The warm haze reads clearly. */}
    {speakerFoot && <Image testID="speaking-ring" source={haze} resizeMode="stretch" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { left: point(speakerFoot.x, speakerFoot.y).left - RING.width / 2, top: point(speakerFoot.x, speakerFoot.y).top - RING.height / 2 }]} />}
    {figures.map(({ id, walker, node }) => <Fragment key={id}>
      <Animated.View testID={`room-${id}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.figure, { left, top, transform: [
        { translateX: walker.position.x.interpolate({ inputRange: [0, 1], outputRange: [-FIGURE_WIDTH / 2, sceneWidth - FIGURE_WIDTH / 2] }) },
        { translateY: walker.position.y.interpolate({ inputRange: [0, 1], outputRange: [-FIGURE_HEIGHT * FIGURE_FOOT, sceneHeight - FIGURE_HEIGHT * FIGURE_FOOT] }) },
      ] }]}>
        <View style={styles.figureShadow} />
        {node}
      </Animated.View>
      {sealsFront && <>
      <Animated.Image testID={`seals-cut-${id}`} source={sealsFront.source} resizeMode="stretch" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[styles.front, { ...point(sealsFront.box[0] / ARTWORK.width, sealsFront.box[1] / ARTWORK.height), width: sealsFront.box[2] / ARTWORK.width * sceneWidth, height: sealsFront.box[3] / ARTWORK.height * sceneHeight, opacity: sealsCover(walker.position) }]} />
      {/* Native check: the cut hid the seal glow, so the seals darkened as he stepped behind them. The glow is repeated over the cut. */}
      <Animated.Image source={haze} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.objectGlow, styles.front, { ...point(seals.x, seals.y), opacity: Animated.multiply(stationGlow('seals'), sealsCover(walker.position)) }]} />
      </>}
    </Fragment>)}
    {!tour && !guidePlace && !guide.walking && (guide.arrived ?? 'aside') === 'aside' && <Pressable accessibilityRole="button" accessibilityLabel={t('room.talk.label')}
      onPress={still(() => { onTalk(); setBubbleOpen(false); setTalk(current => ({ id: (current?.id ?? 0) + 1, spoken: !!progress.today, refreshing: false })); })}
      style={[styles.talkTarget, talkBox]} />}
    </Animated.View>
    </Animated.View>
    {flight.overlay(viewport)}
    {flight.busy && <View testID="flight-shield" style={styles.shield} onStartShouldSetResponder={() => true} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
    {/* MVP-22-B3: the way back to the menu stays visible in every room mode. It is fixed to the screen, outside the camera. */}
    {/* It hides during a flight out and the return flight from a place, so it never sits on the close-up. */}
    {!flight.place && <SafeAreaView testID="room-menu-corner" pointerEvents="box-none" style={styles.corner}>
      <Pressable testID="room-menu-plate" accessibilityRole="button" accessibilityLabel={t('forge.returnMenu')} onPress={still(leaveToMenu)}
        style={({ pressed }) => [styles.menuPlate, pressed && styles.menuPlatePressed]}>
        <Text accessible={false} numberOfLines={1} maxFontSizeMultiplier={PLATE_SCALE} style={styles.menuPlateText}>‹ {t('forge.returnMenu')}</Text>
      </Pressable>
    </SafeAreaView>}
    {/* The panel leaves with the camera, so the close-up is not covered during the flight. */}
    {line && !flight.busy && <DialoguePanel frame={{ left: (viewport.width - panelWidth) / 2, width: panelWidth, bottom: PANEL_BOTTOM, maxHeight: viewport.height - PANEL_BOTTOM - stationEdge }}
      speaker={line.speaker} lineId={line.id} text={line.key ? bindShortWords(t(line.key, line.values), i18n.language) : ''} title={line.title}
      extra={talk && line.id === `talk-${talk.id}` ? <TalkCounters progress={progress} waiting={!talk.spoken} /> : undefined}
      playerName={character.name} portrait={presetArt(art.presets, character.presetId, character.build)?.portrait ?? null} allowed={allowed} more={!!line.more}
      continueLabel={t('room.tutorial.next')} onContinue={still(() => line?.next?.())} controls={line.controls}
      dismissLabel={t(guidePlace ? 'room.guide.skip' : tour ? 'room.tutorial.close' : 'room.dismiss')} onDismiss={still(line.dismiss)} />}
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
  talkTarget: { position: 'absolute', zIndex: 3 },
  shield: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  // The game plate of the heard mark and the speaker (MVP-22-B2), as a 44 pt control. Hotspots, figures and the panel all sit well below it.
  corner: { position: 'absolute', top: 0, left: 0, zIndex: 4 },
  menuPlate: { marginLeft: PLATE_INSET.left, marginTop: PLATE_INSET.top, minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 6,
    backgroundColor: tokens.warm.raised, borderWidth: 1, borderColor: tokens.warm.role,
    shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  menuPlatePressed: { backgroundColor: tokens.warm.chosen },
  menuPlateText: { color: tokens.warm.bright, fontFamily: tokens.font.display, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  ring: { position: 'absolute', zIndex: 3, width: RING.width, height: RING.height, tintColor: '#ffc46e', opacity: 0.9, pointerEvents: 'none' },
});
