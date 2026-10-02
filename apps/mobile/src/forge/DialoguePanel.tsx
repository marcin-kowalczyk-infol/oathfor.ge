import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, PixelRatio, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { Text } from '../ui/Text';
import { tokens } from '../ui/tokens';
import { useTranslation } from '../localization/LocalizationProvider';
import { plainText } from '../localization/typography';
import { useArt } from '../art/ArtProvider';
import type { Speaker } from './conversation';

export const TYPE_MS = 30;
const BUST = 76;
const BUST_RISE = 40;
/** How far Żaromir's painted bust rises above the panel's frame. A screen that scrolls under the panel clears this much more. */
export const PANEL_RISE = BUST_RISE + 8;
const SLIDE = 24;
const SWAP_MS = 220;
// Busts sit inside the corners, clear of the × in the top right.
const BUST_INSET = 50;
// The painted frame and Żaromir's bust come from the style's art (src/art). The frame is exported for 3x screens: 1 point is 3 pixels.
const CORNER = 96 / 3;
const EDGE = 80 / 3;
const TILE_H = 142 / 3;
const TILE_V = 127 / 3;
const PLATE = { width: 612 / 3 * 0.8, height: 128 / 3 * 0.8 };
const RUNE = 26;
/** MVP-22 G35: the longest the panel waits for its art before it shows its text anyway. */
export const ART_WAIT_MS = 600;
// The art the first frame needs. The rune shows only once a line is whole.
const FIRST_FRAME_ART = ['fill', 'corner', 'edgeH', 'edgeV', 'plate', 'bust'] as const;
type FrameArt = typeof FIRST_FRAME_ART[number];
// Hermes may lack Intl.Segmenter. Code points then keep Polish letters whole, only joined emoji may split for a moment.
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemesOf = (text: string) => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);

type Step = { count: string; label: string; mark?: string; text?: boolean; onPress: () => void };
/** expand: "Więcej" on a tutorial chapter's bark (MVP-22-E2.3). It takes the counter's place in the step row. */
export type PanelControls = { action?: { label: string; onPress: () => void }; step?: Step; expand?: { label: string; onPress: () => void } };

/**
 * The carved dialogue panel of the Forge room (docs/product/forge-scene.md "Dialogue panel").
 * The room decides its frame: the bottom edge stays fixed and the panel grows upward to maxHeight.
 * A new lineId types its text again. The first touch shows the whole line, the next calls onContinue.
 * The frame, plate and rune are the painted exports of docs/art/forge-scene-assets.md. Both busts are drawn over the frame.
 */
export function DialoguePanel({ frame, speaker, lineId, text, title, extra, playerName, portrait, allowed, more, continueLabel, onContinue, controls, dismissLabel, onDismiss, onHeight }: {
  frame: { left: number; width: number; bottom: number; maxHeight: number };
  speaker: Speaker; lineId: string; text: string; title?: string;
  /** Content under the line, for example Żaromir's counters. */
  extra?: ReactNode; playerName: string; portrait: ImageSourcePropType | null;
  allowed: boolean;
  /** Another line follows, so a whole line shows the rune. */
  more: boolean;
  continueLabel: string; onContinue: () => void; controls?: PanelControls; dismissLabel: string; onDismiss: () => void;
  /** The panel's measured height, for a screen that keeps its content clear of it. */
  onHeight?: (height: number) => void;
}) {
  const { panel: art, zharomirBust: zharomir } = useArt();
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const graphemes = graphemesOf(text);
  // A line is its id and text, so a new text under the same id (a language change) types again.
  const shown = `${lineId}\u0000${text}`;
  const [typed, setTyped] = useState({ shown, count: allowed ? 0 : graphemes.length });
  // A new line restarts on its first render, not one render later. Without motion a line shows whole and stays whole,
  // so motion returning after the app was in the background never takes text back.
  if (typed.shown !== shown) setTyped({ shown, count: allowed ? 0 : graphemes.length });
  else if (!allowed && typed.count < graphemes.length) setTyped({ shown, count: graphemes.length });
  const count = typed.shown === shown && allowed ? typed.count : graphemes.length;
  const whole = count >= graphemes.length;
  useEffect(() => {
    if (!allowed) return;
    const ticks = setInterval(() => setTyped(current => {
      if (current.count >= graphemes.length) { clearInterval(ticks); return current; }
      return { ...current, count: current.count + 1 };
    }), TYPE_MS);
    return () => clearInterval(ticks);
  }, [allowed, shown]);

  // Each bust is present (1) or gone (0). A new speaker slides the old bust out and the new one in.
  const busts = useRef({ guide: new Animated.Value(speaker === 'guide' ? 1 : 0), player: new Animated.Value(speaker === 'player' ? 1 : 0) }).current;
  const lastSpeaker = useRef(speaker);
  useEffect(() => {
    // An interrupted swap (motion changed mid-way) settles on the current speaker.
    if (lastSpeaker.current === speaker) { busts[speaker].setValue(1); busts[speaker === 'guide' ? 'player' : 'guide'].setValue(0); return; }
    const old = busts[lastSpeaker.current];
    lastSpeaker.current = speaker;
    if (!allowed) { old.setValue(0); busts[speaker].setValue(1); return; }
    const swap = Animated.parallel([
      Animated.timing(old, { toValue: 0, duration: SWAP_MS, useNativeDriver: true }),
      Animated.timing(busts[speaker], { toValue: 1, duration: SWAP_MS, useNativeDriver: true }),
    ]);
    swap.start();
    return () => swap.stop();
  }, [allowed, busts, speaker]);

  const rune = useRef(new Animated.Value(1)).current;
  // The rune continues a line without its own controls. It stays mounted while the next line types, so VoiceOver keeps its focus.
  const runeButton = more && !controls;
  const showRune = whole && runeButton;
  useEffect(() => {
    if (!showRune || !allowed) { rune.setValue(1); return; }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(rune, { toValue: 0.35, duration: 700, isInteraction: false, useNativeDriver: true }),
      Animated.timing(rune, { toValue: 1, duration: 700, isInteraction: false, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [allowed, rune, showRune]);

  const name = speaker === 'guide' ? t('room.speaker') : playerName;
  function press() {
    if (!whole) { setTyped({ shown, count: graphemes.length }); return; }
    onContinue();
  }
  const bust = (who: Speaker) => {
    const value = busts[who];
    const side = who === 'guide' ? -1 : 1;
    return <Animated.View testID={`bust-${who}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.bust, who === 'guide' ? [styles.paintedBust, { left: BUST_INSET }] : { right: BUST_INSET }, { opacity: value, transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [side * SLIDE, 0] }) }] }]}>
      {who === 'guide' ? <Image testID="bust-guide-image" source={zharomir} resizeMode="contain" onLoadEnd={artLoaded('bust')} style={styles.guideBust} />
        : portrait ? <Image testID="bust-player-image" source={portrait} resizeMode="cover" style={styles.portrait} /> : <View style={styles.noPortrait} />}
    </Animated.View>;
  };
  // Callers pass drawn prose with its bindings. The spoken label keeps the plain form (MVP-22-G24, G31).
  const body = <Text testID="dialogue-text" accessibilityLabel={`${name}: ${plainText(text)}`} maxFontSizeMultiplier={2} style={styles.text}>
    {graphemes.slice(0, count).join('')}
    {/* The untyped rest keeps its place, so the panel never grows while typing. */}
    <Text style={styles.untyped}>{graphemes.slice(count).join('')}</Text>
  </Text>;

  // MVP-22 G28: whole device pixel edges, so the strips meet the corners on a whole pixel (styles.edgeH). Both edges are snapped, then the width follows.
  const left = PixelRatio.roundToNearestPixel(frame.left);
  const width = PixelRatio.roundToNearestPixel(frame.left + frame.width) - left;
  const bottom = PixelRatio.roundToNearestPixel(frame.bottom);
  const maxHeight = PixelRatio.roundToNearestPixel(frame.maxHeight);
  // MVP-22 G34: the height follows the text and can end in half a device pixel (ui/textSlack.ts). Yoga rounds a child's place
  // from its parent but its size from screen edges, so at that tie the side strips ended a pixel above the lower corners.
  // The frame takes the panel's measured height instead. Both readings arrive already rounded by Yoga to whole device pixels,
  // so snapping only absorbs float noise and the frame ends exactly at the panel's reported bottom, never below it.
  // The layout effect reads it before the frame is shown, onLayout covers a change from inside `extra`.
  // MVP-22 G35, native check on iPhone 18 Pro: after a cold launch the first panel showed its text without its frame, plate and bust.
  // The panel stays invisible until each of them has loaded or failed, at most ART_WAIT_MS. It still reads and takes touches.
  // The menu fetches the files ahead (panelArt.ts), so the wait is usually a frame. The panel then appears at once, with no fade.
  const loadedArt = useRef(new Set<FrameArt>());
  const [artReady, setArtReady] = useState(false);
  const artLoaded = (part: FrameArt) => () => {
    loadedArt.current.add(part);
    if (loadedArt.current.size === FIRST_FRAME_ART.length) setArtReady(true);
  };
  useEffect(() => {
    if (artReady) return;
    const wait = setTimeout(() => setArtReady(true), ART_WAIT_MS);
    return () => clearTimeout(wait);
  }, [artReady]);
  const panelRef = useRef<View>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const measured = (height: number) => {
    const snapped = PixelRatio.roundToNearestPixel(height);
    setFrameHeight(current => current === snapped ? current : snapped);
  };
  useLayoutEffect(() => {
    const height = panelRef.current?.getBoundingClientRect?.().height;
    if (height) measured(height);
  });
  return <View ref={panelRef} testID="dialogue-panel" onLayout={event => { measured(event.nativeEvent.layout.height); onHeight?.(event.nativeEvent.layout.height); }}
    style={[styles.panel, { left, width, bottom, maxHeight }, largeText && { height: maxHeight }, !artReady && styles.waiting]}>
    <PaintedFrame width={width} height={maxHeight} fill={frameHeight} onArt={artLoaded} />
    {/* Owner review 2026-09-28: the frame hid the lower half of the player's medallion. Busts sit over it. */}
    {bust('guide')}
    {bust('player')}
    <View testID="dialogue-plate" pointerEvents="none" style={[styles.plate, speaker === 'guide' ? { left: BUST_INSET + BUST + 6 } : { right: BUST_INSET + BUST + 6 }]}>
      <Image testID="dialogue-plate-image" source={art.plate} resizeMode="stretch" onLoadEnd={artLoaded('plate')} style={[styles.plateImage, PLATE]} />
      <Text accessible={false} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.plateName}>{name}</Text>
    </View>
    {/* Native check, 2026-09-30: on iOS a scroll view does not drag while a view above it holds the touch, so a drag in a long line
        acted as a tap and skipped it. The touch target sits inside the scroll view, where a drag cancels the press. */}
    <View style={[styles.touch, largeText ? styles.fill : styles.fit]}>
      {title ? <Pressable accessible={false} onPress={press}><Text accessibilityRole="header" maxFontSizeMultiplier={2.4} style={styles.title}>{title}</Text></Pressable> : null}
      <ScrollView testID="dialogue-scroll" style={largeText ? styles.fill : styles.fit} contentContainerStyle={largeText && styles.grow} accessibilityLiveRegion="polite">
        <Pressable testID="dialogue-panel-touch" accessible={false} onPress={press} style={largeText && styles.grow}>{body}{extra}</Pressable>
      </ScrollView>
    </View>
    {(controls?.action || controls?.step) && <View style={styles.controls}>
      {controls.action && <Pressable accessibilityRole="button" accessibilityLabel={controls.action.label} onPress={controls.action.onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
        <Text accessible={false} maxFontSizeMultiplier={tokens.maxScale.display} numberOfLines={1} style={styles.actionLabel}>{controls.action.label} →</Text>
      </Pressable>}
      {controls.step && <View testID="dialogue-step" style={styles.step}>
        {controls.expand
          ? <Pressable accessibilityRole="button" accessibilityLabel={controls.expand.label} onPress={controls.expand.onPress} style={({ pressed }) => [styles.textNext, styles.expand, pressed && styles.pressed]}>
            <Text accessible={false} maxFontSizeMultiplier={tokens.maxScale.display} numberOfLines={1} style={styles.nextLabel}>{controls.expand.label}</Text>
          </Pressable>
          : <Text accessible={false} allowFontScaling={false} style={styles.count}>{controls.step.count}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={controls.step.label} onPress={controls.step.onPress} style={({ pressed }) => [controls.step!.text ? styles.textNext : styles.next, pressed && styles.pressed]}>
          {controls.step.text ? <Text accessible={false} maxFontSizeMultiplier={tokens.maxScale.display} numberOfLines={1} style={styles.nextLabel}>{controls.step.label}</Text>
            : <Text accessible={false} allowFontScaling={false} style={styles.nextMark}>{controls.step.mark ?? '→'}</Text>}
        </Pressable>
      </View>}
    </View>}
    {/* MVP-22-B2 (G11): the continue mark has its own 44 pt row under the text, clear of the ×, in the ×'s cream. */}
    {runeButton && <View testID="dialogue-rune-row" style={styles.runeRow}><Pressable testID="dialogue-rune" accessibilityRole="button" accessibilityLabel={continueLabel} onPress={press} style={styles.runeTouch}>
      {showRune && <View testID="dialogue-rune-mark" style={styles.rune}>
        <Animated.View style={[styles.runeCell, { opacity: rune }]}><Image testID="dialogue-rune-image" source={art.rune} resizeMode="stretch" style={styles.runeImage} /></Animated.View>
      </View>}
    </Pressable></View>}
    <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} onPress={onDismiss} style={styles.dismiss}>
      <Text accessible={false} allowFontScaling={false} style={styles.dismissMark}>×</Text>
    </Pressable>
  </View>;
}

/**
 * Corners and repeated braid tiles, never a stretched frame, because a stretched braid distorts (agent review 2026-09-28).
 * Tiles are counted for the panel's width and its height limit and clipped at the corners.
 */
function PaintedFrame({ width, height, fill, onArt }: { width: number; height: number; fill: number | null; onArt: (part: FrameArt) => () => void }) {
  const art = useArt().panel;
  const across = Math.max(0, Math.ceil((width - 2 * CORNER + 2) / TILE_H));
  const down = Math.max(0, Math.ceil((height - 2 * CORNER + 2) / TILE_V));
  const tiles = (count: number, id: string, size: { width: number; height: number }, part: 'edgeH' | 'edgeV') =>
    Array.from({ length: count }, (_, index) => <Image key={index} testID={id} source={art[part]} resizeMode="stretch" onLoadEnd={onArt(part)} style={size} />);
  const corner = (id: string, place: object, flip: object[]) =>
    <Image testID={`panel-corner-${id}`} source={art.corner} resizeMode="stretch" onLoadEnd={onArt('corner')} style={[styles.corner, place, { transform: flip }]} />;
  return <View testID="panel-frame" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={fill == null ? StyleSheet.absoluteFill : [styles.frame, { height: fill }]}>
    {/* Native check, 2026-09-30: a covering image is not clipped to its box on iOS, so the wood reached the screen edges. */}
    <View testID="panel-fill-clip" style={styles.wood}><Image testID="panel-fill" source={art.fill} resizeMode="cover" onLoadEnd={onArt('fill')} style={styles.woodImage} /></View>
    <View style={[styles.edgeH, { top: 0 }]}>{tiles(across, 'panel-edge-top-tile', { width: TILE_H, height: EDGE }, 'edgeH')}</View>
    <View style={[styles.edgeH, { bottom: 0, transform: [{ scaleY: -1 }] }]}>{tiles(across, 'panel-edge-bottom-tile', { width: TILE_H, height: EDGE }, 'edgeH')}</View>
    <View style={[styles.edgeV, { left: 0 }]}>{tiles(down, 'panel-edge-left-tile', { width: EDGE, height: TILE_V }, 'edgeV')}</View>
    <View style={[styles.edgeV, { right: 0, transform: [{ scaleX: -1 }] }]}>{tiles(down, 'panel-edge-right-tile', { width: EDGE, height: TILE_V }, 'edgeV')}</View>
    {corner('tl', { left: 0, top: 0 }, [])}
    {corner('tr', { right: 0, top: 0 }, [{ scaleX: -1 }])}
    {corner('bl', { left: 0, bottom: 0 }, [{ scaleY: -1 }])}
    {corner('br', { right: 0, bottom: 0 }, [{ scaleX: -1 }, { scaleY: -1 }])}
  </View>;
}

const wood = '#31241d';
const bronze = '#b58a52';
const parchment = '#f0dfb9';
// The cream of the panel's glyphs, the × and the continue mark.
const glyph = '#c9a77a';
const styles = StyleSheet.create({
  panel: { position: 'absolute', zIndex: 5, backgroundColor: wood, borderRadius: 6, paddingTop: 36, paddingBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  // MVP-22 G35: invisible, not unmounted or display none, so its images still load.
  waiting: { opacity: 0 },
  // MVP-22 G34: a measured frame has its own whole pixel height. Until the panel is measured it fills the panel.
  frame: { position: 'absolute', top: 0, left: 0, right: 0 },
  wood: { position: 'absolute', left: 4, top: 4, right: 4, bottom: 4, overflow: 'hidden' },
  woodImage: { width: '100%', height: '100%' },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  // MVP-22-B2 (G11), MVP-22 G28: each strip ends exactly where a corner begins, never under it. Corner and strip edges carry
  // the same translucent inner shadow, so any overlap draws it twice as a dark line. The panel's edges are snapped to whole
  // device pixels and the corner is 96 pixels, so the junction is a whole pixel.
  edgeH: { position: 'absolute', left: CORNER, right: CORNER, height: EDGE, flexDirection: 'row', overflow: 'hidden' },
  edgeV: { position: 'absolute', top: CORNER, bottom: CORNER, width: EDGE, overflow: 'hidden' },
  bust: { position: 'absolute', top: -BUST_RISE, width: BUST, height: BUST, borderRadius: BUST / 2, overflow: 'hidden', backgroundColor: '#44372c', borderColor: bronze, borderWidth: 2 },
  guideBust: { width: '100%', height: '100%' },
  // Żaromir's bust is painted with a transparent background, so it rises free of a round frame.
  paintedBust: { width: BUST + 8, height: BUST + 4, top: -PANEL_RISE, borderRadius: 0, borderWidth: 0, backgroundColor: 'transparent', overflow: 'visible' },
  portrait: { width: '100%', height: '100%' },
  noPortrait: { flex: 1, backgroundColor: '#3a2c20' },
  // The name sits in the plate's text band, clear of its 64 pixel caps.
  plate: { position: 'absolute', top: -PLATE.height / 2, width: PLATE.width, height: PLATE.height, justifyContent: 'center', paddingHorizontal: 64 / 3 * 0.8 + 4 },
  plateImage: { position: 'absolute', left: 0, top: 0 },
  plateName: { color: '#241609', fontFamily: tokens.font.display, fontSize: 15, textAlign: 'center' },
  // The painted band ends 17 points in from the edge.
  touch: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 10, paddingRight: 44 },
  fill: { flex: 1 },
  // At normal size the panel grows with its text and scrolls only once it reaches its height limit.
  fit: { flexGrow: 0, flexShrink: 1 },
  // At large text the panel has a fixed height, so the touch fills the text area and a tap under a short line still continues.
  grow: { flexGrow: 1 },
  title: { color: parchment, fontFamily: tokens.font.display, fontSize: 19, marginBottom: 4 },
  text: { color: parchment, fontFamily: tokens.font.body, fontSize: 16, lineHeight: 23 },
  untyped: { color: 'transparent' },
  // Inside the painted band, which ends 17 points in from the edge.
  controls: { flexShrink: 0, paddingHorizontal: 18, paddingBottom: 10 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  actionLabel: { color: '#e7b86e', fontFamily: tokens.font.body, fontSize: 17, fontWeight: '600' },
  step: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6 },
  count: { color: '#c9a77a', fontSize: 12 },
  next: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center' },
  nextMark: { color: '#e7b86e', fontSize: 30 },
  textNext: { height: 44, flexShrink: 1, justifyContent: 'center', paddingHorizontal: 10 },
  // "Więcej" starts where the counter does, so its word lines up with the text above.
  expand: { marginLeft: -10 },
  nextLabel: { color: '#e7b86e', fontFamily: tokens.font.body, fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  // Inside the painted band like the step row, right-aligned under the ×.
  runeRow: { flexShrink: 0, height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 12 },
  runeTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Its first cell shows, the opacity pulses. The tint gives the painted shape the ×'s cream, because the bronze cinematic rune vanished on the wood.
  rune: { width: RUNE, height: RUNE },
  runeCell: { width: RUNE, height: RUNE, overflow: 'hidden' },
  runeImage: { position: 'absolute', left: 0, top: 0, width: RUNE * 4, height: RUNE * 2, tintColor: glyph },
  dismiss: { position: 'absolute', right: 6, top: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissMark: { color: glyph, fontSize: 28 },
});
