import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import type { Character } from '../api/characters';
import { presetArt } from '../characters/presetArt';
import { useTranslation } from '../localization/LocalizationProvider';
import { layoutMode, type LayoutMode } from '../ui/layoutMode';
import { StateSeal } from '../ui/StateSeal';
import { tokens } from '../ui/tokens';
import { useMotionAllowed } from '../ui/useMotion';
import type { OathSummaryState } from './useOathSummary';

export type MainMenuScreenProps = {
  character: Character; summary: OathSummaryState; pending: boolean; layout: LayoutMode;
  onForge(): void; onTutorial(): void; onSettings(): void; onChangeCharacter(): void;
};

const room = require('../../assets/forge/room-prototype-v03.png');
const wanderer = require('../../assets/companion/zharomir-wanderer-v01.png');
const tools = require('../../assets/menu/settings-tools-v01.jpg');
const ROOM = { width: 887, height: 1774 };
// The Forge tile frames the room from the door to the lectern, centred on this share of the artwork height.
const ROOM_TILE_CENTER = 0.463;
const TOOLS = { width: 480, height: 600 };
const FIGURE_RATIO = 400 / 984;
// Values follow the accepted mockup menu-card-v6 at 390 × 844 pt.
const gold = { line: 'rgba(214,170,105,0.55)', faint: 'rgba(214,170,105,0.22)', tile: 'rgba(214,170,105,0.35)', mark: '#c9a46c', role: '#caa06a', name: '#f6e6c8', pill: '#e6c690' };
const CARD_HEIGHT = 300;
const FIGURE_HEIGHT = 282;
const FORGE_HEIGHT = 190;
const HALF_HEIGHT = 176;
const DETAIL_LINE = 16;

/** Home screen after a character exists. Presentational: the caller owns routes, the summary request and the pending acceptance. */
export function MainMenuScreen({ character, summary, pending, layout, onForge, onTutorial, onSettings, onChangeCharacter }: MainMenuScreenProps) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  // The window rule for the simple layout also stacks the card and turns the tiles into full-width rows.
  const stacked = layoutMode(width, fontScale) === 'simple';
  const tile = (title: string, detail: string) => ({ title, detail, label: `${title}, ${detail}` });
  const forge = tile(t('menu.forge'), t(pending ? 'menu.forgePending' : 'menu.forgeDetail'));
  const tutorial = tile(t('menu.tutorial'), t('menu.tutorialDetail'));
  const settings = tile(t('menu.settings'), t('menu.settingsDetail'));
  // Side by side, both subtitles reserve the taller one's lines, so the two titles share a baseline.
  const [detailLines, setDetailLines] = useState<Record<string, number>>({});
  const pairLines = stacked ? 0 : Math.max(0, ...Object.values(detailLines));
  const reportLines = (id: string) => (lines: number) => setDetailLines(current => current[id] === lines ? current : { ...current, [id]: lines });
  return <View style={styles.root}>
    <Backdrop />
    <SafeAreaView style={styles.safeArea}>
      {/* iOS keeps stale text measurements after a live Dynamic Type change, so the content remounts, as in SceneSurface. */}
      <ScrollView key={fontScale} contentContainerStyle={styles.content}>
        <View accessible accessibilityRole="header" accessibilityLabel="Oathforge" style={styles.wordmark}>
          <View style={[styles.hairline, styles.hairlineLeft]} />
          <Text maxFontSizeMultiplier={tokens.maxScale.name} style={styles.wordmarkText}>OATHFORGE</Text>
          <View style={[styles.hairline, styles.hairlineRight]} />
        </View>
        <CharacterCard character={character} summary={summary} stacked={stacked} onChangeCharacter={onChangeCharacter} />
        <View style={styles.tiles}>
          <ForgeTile {...forge} stacked={stacked} onPress={onForge} />
          <View testID="menu-tile-pair" style={[styles.pair, stacked && styles.column]}>
            {layout !== 'simple' && <Tile testID="menu-tutorial" {...tutorial} stacked={stacked} detailLines={pairLines} onDetailLines={reportLines('tutorial')} onPress={onTutorial} art={size => <TutorialArt size={size} stacked={stacked} />} />}
            <Tile testID="menu-settings" {...settings} stacked={stacked} detailLines={layout === 'simple' ? 0 : pairLines} onDetailLines={reportLines('settings')} onPress={onSettings} art={size => <CoverArt source={tools} art={TOOLS} size={size} />} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  </View>;
}

/** The room, blurred and darkened, with a warm glow high up and a vignette towards the tiles. */
function Backdrop() {
  const { width, height } = useWindowDimensions();
  const cover = Math.max(width / ROOM.width, height / ROOM.height);
  const frame = { width: cover * ROOM.width, height: cover * ROOM.height, left: (width - cover * ROOM.width) / 2, top: (height - cover * ROOM.height) * 0.38 };
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fill}>
    {/* The blur radius is in image pixels. The artwork is drawn at about two pixels per point. */}
    <Image source={room} resizeMode="stretch" blurRadius={12} style={[styles.layer, frame, styles.roomZoom]} />
    <View style={[styles.fill, styles.darken]} />
    <View style={[styles.fill, styles.vignette]} />
    <View style={[styles.fill, styles.warmth]} />
  </View>;
}

function CharacterCard({ character, summary, stacked, onChangeCharacter }: { character: Character; summary: OathSummaryState; stacked: boolean; onChangeCharacter(): void }) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const art = presetArt(character.presetId);
  // A summary of the previous character is never shown after a switch.
  const current = summary.kind === 'ready' && summary.characterId === character.id ? summary : null;
  const label = current ? t('menu.currentOaths', { count: current.total }) : t('menu.currentOathsLabel');
  const figureHeight = stacked ? 240 : FIGURE_HEIGHT;
  const figure = <View testID={art ? undefined : 'menu-figure-placeholder'} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.figure, stacked ? styles.stackedFigure : styles.rowFigure, { height: figureHeight, width: figureHeight * FIGURE_RATIO }]}>
    {art ? <Image testID="menu-figure" source={art.figure} resizeMode="contain" style={styles.figureImage} />
      : <View style={styles.placeholder}><Text allowFontScaling={false} style={styles.initial}>{[...character.name][0] ?? ''}</Text></View>}
  </View>;
  return <View testID={stacked ? 'menu-card-stacked' : 'menu-card'} style={styles.cardShadow}>
    <View style={[styles.card, !stacked && styles.rowCard]}>
      {/* The double hairline sits under the light and the figure, as in the mockup. */}
      <View pointerEvents="none" style={[styles.frameLine, styles.frameOuter]} />
      <View pointerEvents="none" style={[styles.frameLine, styles.frameBand]} />
      <View pointerEvents="none" style={[styles.frameLine, styles.frameInner]} />
      {stacked ? <View style={styles.stage}>
        <View pointerEvents="none" style={[styles.fill, styles.stageGlow]} />
        <View pointerEvents="none" style={styles.stagePool} />
        {figure}
      </View> : <>
        <View pointerEvents="none" style={[styles.fill, styles.cardGlow]} />
        <View pointerEvents="none" style={styles.floor} />
        {figure}
      </>}
      <View style={stacked ? styles.stackedIdentity : styles.identity}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={tokens.maxScale.name} style={styles.name}>{character.name}</Text>
        <Text maxFontSizeMultiplier={tokens.maxScale.display} style={[styles.role, fontScale > 1.5 && styles.roleLarge]}>{t(`character.form.${character.form}`)}</Text>
        <View style={styles.rule} />
        <View testID="menu-stat" accessible accessibilityLabel={current ? `${current.total} ${label}` : t('menu.currentOathsUnknown')} style={styles.stat}>
          <View style={styles.seal}>
            <View style={styles.sealArt}><StateSeal state="active" size={50} /></View>
          </View>
          <View style={styles.statText}>
            <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.count}>{current ? String(current.total) : '–'}</Text>
            <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.statLabel}>{label}</Text>
          </View>
        </View>
        {current?.paused && <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.paused}>{t('menu.paused')}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={t('menu.changeCharacter')} onPress={onChangeCharacter} style={styles.pillTarget}>
          {({ pressed }) => <View style={[styles.pill, pressed && styles.pillPressed]}>
            <Text allowFontScaling={false} style={styles.pillMark}>✎</Text>
            <Text {...(stacked ? {} : { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75 })} maxFontSizeMultiplier={tokens.maxScale.display} style={styles.pillLabel}>{t('menu.changeCharacter')}</Text>
          </View>}
        </Pressable>
      </View>
    </View>
  </View>;
}

type TileProps = { title: string; detail: string; label: string; stacked: boolean; onPress(): void };
type Size = { width: number; height: number };

/** Measures the tile so cropped artwork keeps its framing at any width and height. */
function useSize(initial: Size) {
  const [size, setSize] = useState(initial);
  const onLayout = ({ nativeEvent: { layout } }: { nativeEvent: { layout: Size } }) => {
    if (layout.width > 0 && layout.height > 0 && (layout.width !== size.width || layout.height !== size.height)) setSize({ width: layout.width, height: layout.height });
  };
  return [size, onLayout] as const;
}

function ForgeTile({ title, detail, label, stacked, onPress }: TileProps) {
  const { width } = useWindowDimensions();
  const [size, onLayout] = useSize({ width: width - 40, height: FORGE_HEIGHT });
  const motion = useMotionAllowed();
  const glow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    glow.stopAnimation(); glow.setValue(1);
    if (!motion) return;
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.55, duration: 1800, easing: Easing.inOut(Easing.sin), isInteraction: false, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), isInteraction: false, useNativeDriver: true }),
    ]));
    breathe.start();
    return () => { breathe.stop(); glow.setValue(1); };
  }, [glow, motion]);
  // The room is drawn at the tile width. Its framing stays inside the artwork when the tile grows with large text.
  const imageHeight = size.width * (ROOM.height / ROOM.width);
  const top = Math.min(0, Math.max(size.height - imageHeight, size.height / 2 - imageHeight * ROOM_TILE_CENTER));
  return <View style={styles.forgeSlot}>
    <Animated.View pointerEvents="none" style={[styles.forgeGlow, { opacity: glow }]} />
    <Pressable testID="menu-forge" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLayout={onLayout}
      style={({ pressed }) => [styles.tile, styles.forgeTile, { minHeight: FORGE_HEIGHT }, pressed && styles.pressed]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.clip}>
        <Image source={room} resizeMode="stretch" style={[styles.layer, { left: 0, top, width: size.width, height: imageHeight }]} />
        <View style={[styles.fill, stacked ? styles.deepFade : styles.fade]} />
      </View>
      <TileLabel title={title} detail={detail} stacked={stacked} hero />
      <View pointerEvents="none" style={styles.go}><Text allowFontScaling={false} style={styles.goArrow}>→</Text></View>
    </Pressable>
  </View>;
}

function Tile({ testID, title, detail, label, stacked, onPress, art, detailLines, onDetailLines }: TileProps & { testID: string; art(size: Size): ReactNode; detailLines: number; onDetailLines(lines: number): void }) {
  const { width } = useWindowDimensions();
  const [size, onLayout] = useSize({ width: (width - 52) / 2, height: HALF_HEIGHT });
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLayout={onLayout}
    style={({ pressed }) => [styles.tile, styles.halfTile, stacked && styles.fullTile, pressed && styles.pressed]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.clip}>
      {art(size)}
      <View style={[styles.fill, stacked ? styles.deepFade : styles.fade]} />
    </View>
    <TileLabel title={title} detail={detail} stacked={stacked} detailLines={detailLines} onDetailLines={onDetailLines} />
    {/* The single gold line stays above the artwork. */}
    <View pointerEvents="none" style={styles.tileLine} />
  </Pressable>;
}

function TileLabel({ title, detail, stacked, hero = false, detailLines = 0, onDetailLines }: { title: string; detail: string; stacked: boolean; hero?: boolean; detailLines?: number; onDetailLines?(lines: number): void }) {
  // Half tile titles are single words. They shrink instead of breaking inside the word.
  const fit = !stacked && !hero ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 } : {};
  return <View style={[styles.tileLabel, hero && styles.heroLabel]}>
    <Text {...fit} maxFontSizeMultiplier={tokens.maxScale.display} style={hero ? styles.heroTitle : styles.tileTitle}>{title}</Text>
    <Text onTextLayout={({ nativeEvent }) => onDetailLines?.(nativeEvent.lines.length)} style={[styles.tileDetail, detailLines > 1 && { minHeight: detailLines * DETAIL_LINE }]}>{detail}</Text>
  </View>;
}

function TutorialArt({ size, stacked }: { size: Size; stacked: boolean }) {
  // The companion export has a flat #222 backdrop. The tile uses the same colour, so no edge of the picture shows.
  const figure = { height: 210, width: 140, top: -6 };
  return <View style={[styles.fill, styles.tutorialBackdrop]}>
    <Image source={wanderer} resizeMode="stretch" style={[styles.layer, figure, stacked ? { left: size.width - figure.width - 18 } : { left: 18 }]} />
    <View style={[styles.fill, styles.tutorialGlow]} />
  </View>;
}

function CoverArt({ source, art, size }: { source: ImageSourcePropType; art: Size; size: Size }) {
  const cover = Math.max(size.width / art.width, size.height / art.height);
  const frame = { width: art.width * cover, height: art.height * cover, left: (size.width - art.width * cover) / 2, top: (size.height - art.height * cover) / 2 };
  return <>
    <Image source={source} resizeMode="stretch" style={[styles.layer, frame]} />
    <View style={[styles.fill, styles.dim]} />
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1012' },
  safeArea: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  layer: { position: 'absolute' },
  roomZoom: { transform: [{ scale: 1.08 }] },
  darken: { backgroundColor: 'rgba(0,0,0,0.68)' },
  vignette: { experimental_backgroundImage: 'linear-gradient(180deg, rgba(15,16,18,0.2) 0%, rgba(15,16,18,0.65) 70%, #0f1012 100%)' },
  warmth: { experimental_backgroundImage: 'radial-gradient(120% 70% at 50% 30%, rgba(255,150,60,0.10) 0%, rgba(255,150,60,0) 60%)' },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  wordmark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  wordmarkText: { fontFamily: tokens.font.display, fontSize: 15, lineHeight: 18, letterSpacing: 6, color: gold.mark },
  hairline: { width: 34, height: 1, marginHorizontal: 12 },
  hairlineLeft: { experimental_backgroundImage: 'linear-gradient(90deg, rgba(201,164,108,0) 0%, #c9a46c 100%)' },
  hairlineRight: { experimental_backgroundImage: 'linear-gradient(90deg, #c9a46c 0%, rgba(201,164,108,0) 100%)' },
  cardShadow: { borderRadius: 24, backgroundColor: '#18130e', boxShadow: '0 18px 40px rgba(0,0,0,0.6)' },
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#18130e', experimental_backgroundImage: 'linear-gradient(180deg, #2a1f15 0%, #18130e 100%)' },
  rowCard: { minHeight: CARD_HEIGHT },
  frameLine: { position: 'absolute' },
  frameOuter: { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, borderWidth: 1, borderColor: gold.line },
  frameBand: { top: 1, left: 1, right: 1, bottom: 1, borderRadius: 23, borderWidth: 4, borderColor: 'rgba(20,15,10,0.9)' },
  frameInner: { top: 5, left: 5, right: 5, bottom: 5, borderRadius: 19, borderWidth: 1, borderColor: gold.faint },
  cardGlow: { experimental_backgroundImage: 'radial-gradient(60% 70% at 30% 75%, rgba(255,160,70,0.28) 0%, rgba(255,160,70,0) 70%)' },
  // Stacked, the light ends inside the stage, so no edge shows where the text begins.
  stageGlow: { experimental_backgroundImage: 'radial-gradient(closest-side at 50% 58%, rgba(255,160,70,0.28) 0%, rgba(255,160,70,0) 100%)' },
  stagePool: { position: 'absolute', bottom: -8, left: '50%', marginLeft: -80, width: 160, height: 28, experimental_backgroundImage: 'radial-gradient(closest-side, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)' },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, experimental_backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)' },
  stage: { height: 262, alignItems: 'center', justifyContent: 'flex-end' },
  figure: { shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 7, shadowOffset: { width: 0, height: 10 } },
  rowFigure: { position: 'absolute', left: 6, bottom: 0 },
  stackedFigure: {},
  figureImage: { width: '100%', height: '100%' },
  placeholder: { flex: 1, marginHorizontal: 8, marginTop: 24, marginBottom: 8, borderRadius: 999, borderWidth: 1, borderColor: gold.faint, alignItems: 'center', justifyContent: 'center',
    experimental_backgroundImage: 'radial-gradient(closest-side, rgba(255,160,70,0.22) 0%, rgba(255,160,70,0) 100%)' },
  initial: { fontFamily: tokens.font.display, color: gold.name, fontSize: 48, lineHeight: 56 },
  // 10 pt left of the mockup, so the English pill fits on one line beside the figure.
  identity: { marginLeft: 168, marginRight: 20, paddingTop: 34, paddingBottom: 18 },
  stackedIdentity: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 },
  name: { fontFamily: tokens.font.display, color: gold.name, fontSize: 32, lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  role: { marginTop: 4, color: gold.role, fontSize: 13, lineHeight: 16, letterSpacing: 2.5, textTransform: 'uppercase' },
  roleLarge: { letterSpacing: 1 },
  rule: { marginTop: 18, marginBottom: 16, height: 1, experimental_backgroundImage: 'linear-gradient(90deg, rgba(214,170,105,0.7) 0%, rgba(214,170,105,0) 100%)' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seal: { width: 44, height: 44, borderRadius: 22, boxShadow: '0 0 14px rgba(255,140,50,0.55)' },
  // The wax disc fills 87 percent of its cell, so a 50 pt cell gives the 44 pt seal.
  sealArt: { position: 'absolute', left: -3, top: -3 },
  statText: { flexShrink: 1 },
  count: { fontFamily: tokens.font.display, color: '#ffd08a', fontSize: 30, lineHeight: 32 },
  statLabel: { color: '#bfa682', fontSize: 13, lineHeight: 17 },
  paused: { marginTop: 10, color: tokens.color.neutral, fontSize: 13, lineHeight: 17, fontWeight: '600' },
  // The visible pill is 33 pt high, the touch target keeps 48 pt.
  // The column width limits the pill, so the one-line label shrinks instead of running past the column on a 375 pt screen.
  pillTarget: { marginTop: 14, minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', maxWidth: '100%' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(214,170,105,0.4)', backgroundColor: 'rgba(214,170,105,0.1)' },
  pillPressed: { backgroundColor: 'rgba(214,170,105,0.22)' },
  pillMark: { color: gold.pill, fontSize: 14, lineHeight: 17 },
  pillLabel: { color: gold.pill, fontSize: 14, lineHeight: 17, flexShrink: 1 },
  tiles: { marginTop: 16, gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  column: { flexDirection: 'column' },
  forgeSlot: { borderRadius: 20 },
  forgeGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, boxShadow: '0 0 28px rgba(255,150,60,0.4)' },
  tile: { borderRadius: 20, backgroundColor: '#18140f', justifyContent: 'flex-end' },
  forgeTile: { boxShadow: '0 0 0 1px rgba(255,205,130,0.9), 0 12px 28px rgba(0,0,0,0.6)' },
  halfTile: { flex: 1, minHeight: HALF_HEIGHT, boxShadow: '0 10px 24px rgba(0,0,0,0.5)' },
  fullTile: { flex: 0 },
  pressed: { transform: [{ scale: 0.985 }] },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, overflow: 'hidden' },
  fade: { experimental_backgroundImage: 'linear-gradient(180deg, rgba(15,12,9,0) 35%, rgba(15,12,9,0.88) 100%)' },
  deepFade: { experimental_backgroundImage: 'linear-gradient(180deg, rgba(15,12,9,0.2) 0%, rgba(15,12,9,0.86) 45%, rgba(15,12,9,0.92) 100%)' },
  tileLine: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, borderWidth: 1, borderColor: gold.tile },
  tileLabel: { paddingLeft: 16, paddingRight: 14, paddingBottom: 14, paddingTop: 16 },
  heroLabel: { paddingRight: 72 },
  tileTitle: { color: gold.name, fontSize: 19, lineHeight: 23, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  heroTitle: { fontFamily: tokens.font.display, color: '#ffe3b3', fontSize: 24, lineHeight: 29, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  tileDetail: { marginTop: 3, color: '#cdb48d', fontSize: 13, lineHeight: DETAIL_LINE },
  go: { position: 'absolute', right: 16, bottom: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#dea050', experimental_backgroundImage: 'linear-gradient(180deg, #f3bd6c 0%, #c9832f 100%)', boxShadow: '0 0 16px rgba(255,170,70,0.6)' },
  goArrow: { color: '#1a120a', fontSize: 22, lineHeight: 26 },
  tutorialBackdrop: { backgroundColor: '#222222' },
  tutorialGlow: { experimental_backgroundImage: 'radial-gradient(70% 60% at 45% 45%, rgba(255,170,80,0.16) 0%, rgba(255,170,80,0) 70%)' },
  dim: { backgroundColor: 'rgba(0,0,0,0.2)' },
});
