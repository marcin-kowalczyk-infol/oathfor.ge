import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { Text } from '../ui/Text';
import { tokens } from '../ui/tokens';
import { useTranslation } from '../localization/LocalizationProvider';
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
// Hermes may lack Intl.Segmenter. Code points then keep Polish letters whole, only joined emoji may split for a moment.
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemesOf = (text: string) => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);

type Step = { count: string; label: string; mark?: string; text?: boolean; onPress: () => void };
export type PanelControls = { action?: { label: string; onPress: () => void }; step?: Step };

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
      {who === 'guide' ? <Image testID="bust-guide-image" source={zharomir} resizeMode="contain" style={styles.guideBust} />
        : portrait ? <Image testID="bust-player-image" source={portrait} resizeMode="cover" style={styles.portrait} /> : <View style={styles.noPortrait} />}
    </Animated.View>;
  };
  const body = <Text testID="dialogue-text" accessibilityLabel={`${name}: ${text}`} maxFontSizeMultiplier={2} style={styles.text}>
    {graphemes.slice(0, count).join('')}
    {/* The untyped rest keeps its place, so the panel never grows while typing. */}
    <Text style={styles.untyped}>{graphemes.slice(count).join('')}</Text>
  </Text>;

  return <View testID="dialogue-panel" onLayout={onHeight && (event => onHeight(event.nativeEvent.layout.height))} style={[styles.panel, { left: frame.left, width: frame.width, bottom: frame.bottom, maxHeight: frame.maxHeight }, largeText && { height: frame.maxHeight }]}>
    <PaintedFrame width={frame.width} height={frame.maxHeight} />
    {/* Owner review 2026-09-28: the frame hid the lower half of the player's medallion. Busts sit over it. */}
    {bust('guide')}
    {bust('player')}
    <View testID="dialogue-plate" pointerEvents="none" style={[styles.plate, speaker === 'guide' ? { left: BUST_INSET + BUST + 6 } : { right: BUST_INSET + BUST + 6 }]}>
      <Image testID="dialogue-plate-image" source={art.plate} resizeMode="stretch" style={[styles.plateImage, PLATE]} />
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
      {controls.step && <View style={styles.step}>
        <Text accessible={false} allowFontScaling={false} style={styles.count}>{controls.step.count}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={controls.step.label} onPress={controls.step.onPress} style={({ pressed }) => [controls.step!.text ? styles.textNext : styles.next, pressed && styles.pressed]}>
          {controls.step.text ? <Text accessible={false} maxFontSizeMultiplier={tokens.maxScale.display} numberOfLines={1} style={styles.nextLabel}>{controls.step.label}</Text>
            : <Text accessible={false} allowFontScaling={false} style={styles.nextMark}>{controls.step.mark ?? '→'}</Text>}
        </Pressable>
      </View>}
    </View>}
    {runeButton && <Pressable testID="dialogue-rune" accessibilityRole="button" accessibilityLabel={continueLabel} onPress={press} style={styles.runeTouch}>
      {showRune && <View testID="dialogue-rune-mark" style={styles.rune}>
        <Animated.View style={[styles.runeCell, { opacity: rune }]}><Image testID="dialogue-rune-image" source={art.rune} resizeMode="stretch" style={styles.runeImage} /></Animated.View>
      </View>}
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} onPress={onDismiss} style={styles.dismiss}>
      <Text accessible={false} allowFontScaling={false} style={styles.dismissMark}>×</Text>
    </Pressable>
  </View>;
}

/**
 * Corners and repeated braid tiles, never a stretched frame, because a stretched braid distorts (agent review 2026-09-28).
 * Tiles are counted for the panel's width and its height limit and clipped at the corners.
 */
function PaintedFrame({ width, height }: { width: number; height: number }) {
  const art = useArt().panel;
  const across = Math.max(0, Math.ceil((width - 2 * CORNER) / TILE_H));
  const down = Math.max(0, Math.ceil((height - 2 * CORNER) / TILE_V));
  const tiles = (count: number, id: string, size: { width: number; height: number }, source: number) =>
    Array.from({ length: count }, (_, index) => <Image key={index} testID={id} source={source} resizeMode="stretch" style={size} />);
  const corner = (id: string, place: object, flip: object[]) =>
    <Image testID={`panel-corner-${id}`} source={art.corner} resizeMode="stretch" style={[styles.corner, place, { transform: flip }]} />;
  return <View testID="panel-frame" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    {/* Native check, 2026-09-30: a covering image is not clipped to its box on iOS, so the wood reached the screen edges. */}
    <View testID="panel-fill-clip" style={styles.wood}><Image testID="panel-fill" source={art.fill} resizeMode="cover" style={styles.woodImage} /></View>
    <View style={[styles.edgeH, { top: 0 }]}>{tiles(across, 'panel-edge-top-tile', { width: TILE_H, height: EDGE }, art.edgeH)}</View>
    <View style={[styles.edgeH, { bottom: 0, transform: [{ scaleY: -1 }] }]}>{tiles(across, 'panel-edge-bottom-tile', { width: TILE_H, height: EDGE }, art.edgeH)}</View>
    <View style={[styles.edgeV, { left: 0 }]}>{tiles(down, 'panel-edge-left-tile', { width: EDGE, height: TILE_V }, art.edgeV)}</View>
    <View style={[styles.edgeV, { right: 0, transform: [{ scaleX: -1 }] }]}>{tiles(down, 'panel-edge-right-tile', { width: EDGE, height: TILE_V }, art.edgeV)}</View>
    {corner('tl', { left: 0, top: 0 }, [])}
    {corner('tr', { right: 0, top: 0 }, [{ scaleX: -1 }])}
    {corner('bl', { left: 0, bottom: 0 }, [{ scaleY: -1 }])}
    {corner('br', { right: 0, bottom: 0 }, [{ scaleX: -1 }, { scaleY: -1 }])}
  </View>;
}

const wood = '#31241d';
const bronze = '#b58a52';
const parchment = '#f0dfb9';
const styles = StyleSheet.create({
  panel: { position: 'absolute', zIndex: 5, backgroundColor: wood, borderRadius: 6, paddingTop: 36, paddingBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  wood: { position: 'absolute', left: 4, top: 4, right: 4, bottom: 4, overflow: 'hidden' },
  woodImage: { width: '100%', height: '100%' },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
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
  nextLabel: { color: '#e7b86e', fontFamily: tokens.font.body, fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  runeTouch: { position: 'absolute', right: 8, bottom: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // The rune is light on black, so it blends like the room's light sheets. Its first cell shows, the opacity pulses.
  rune: { width: RUNE, height: RUNE },
  runeCell: { width: RUNE, height: RUNE, overflow: 'hidden' },
  runeImage: { position: 'absolute', left: 0, top: 0, width: RUNE * 4, height: RUNE * 2 },
  dismiss: { position: 'absolute', right: 6, top: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissMark: { color: '#c9a77a', fontSize: 28 },
});
