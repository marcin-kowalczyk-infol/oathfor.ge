import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { tokens } from '../ui/tokens';
import { useTranslation } from '../localization/LocalizationProvider';
import type { Speaker } from './conversation';

export const TYPE_MS = 30;
const BUST = 76;
const BUST_RISE = 40;
const SLIDE = 24;
const SWAP_MS = 220;
// Busts sit inside the corners, clear of the × in the top right.
const BUST_INSET = 50;
const zharomir = require('../../assets/companion/zharomir-wanderer-v01.png');
// Hermes may lack Intl.Segmenter. Code points then keep Polish letters whole, only joined emoji may split for a moment.
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemesOf = (text: string) => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);

type Step = { count: string; label: string; mark?: string; text?: boolean; onPress: () => void };
export type PanelControls = { action?: { label: string; onPress: () => void }; step?: Step };

/**
 * The carved dialogue panel of the Forge room (docs/product/forge-scene.md "Dialogue panel").
 * The room decides its frame: the bottom edge stays fixed and the panel grows upward to maxHeight.
 * A new lineId types its text again. The first touch shows the whole line, the next calls onContinue.
 * Until the painted frame is delivered, code draws the wood, the bronze lines, the plate and the rune.
 */
export function DialoguePanel({ frame, speaker, lineId, text, title, playerName, portrait, allowed, more, continueLabel, onContinue, controls, dismissLabel, onDismiss }: {
  frame: { left: number; width: number; bottom: number; maxHeight: number };
  speaker: Speaker; lineId: string; text: string; title?: string; playerName: string; portrait: ImageSourcePropType | null;
  allowed: boolean;
  /** Another line follows, so a whole line shows the rune. */
  more: boolean;
  continueLabel: string; onContinue: () => void; controls?: PanelControls; dismissLabel: string; onDismiss: () => void;
}) {
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
      style={[styles.bust, who === 'guide' ? { left: BUST_INSET } : { right: BUST_INSET }, { opacity: value, transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [side * SLIDE, 0] }) }] }]}>
      {who === 'guide' ? <Image source={zharomir} resizeMode="stretch" style={styles.guideCrop} />
        : portrait ? <Image testID="bust-player-image" source={portrait} resizeMode="cover" style={styles.portrait} /> : <View style={styles.noPortrait} />}
    </Animated.View>;
  };
  const body = <Text testID="dialogue-text" accessibilityLabel={`${name}: ${text}`} maxFontSizeMultiplier={2} style={styles.text}>
    {graphemes.slice(0, count).join('')}
    {/* The untyped rest keeps its place, so the panel never grows while typing. */}
    <Text style={styles.untyped}>{graphemes.slice(count).join('')}</Text>
  </Text>;

  return <View testID="dialogue-panel" style={[styles.panel, { left: frame.left, width: frame.width, bottom: frame.bottom, maxHeight: frame.maxHeight }, largeText && { height: frame.maxHeight }]}>
    {bust('guide')}
    {bust('player')}
    <View pointerEvents="none" style={styles.innerLine} />
    <View testID="dialogue-plate" pointerEvents="none" style={[styles.plate, speaker === 'guide' ? { left: BUST_INSET + BUST + 12 } : { right: BUST_INSET + BUST + 12 }]}>
      <Text accessible={false} allowFontScaling={false} numberOfLines={1} style={styles.plateName}>{name}</Text>
    </View>
    <Pressable testID="dialogue-panel-touch" accessible={false} onPress={press} style={[styles.touch, largeText ? styles.fill : styles.fit]}>
      {title ? <Text accessibilityRole="header" maxFontSizeMultiplier={2.4} style={styles.title}>{title}</Text> : null}
      <ScrollView testID="dialogue-scroll" style={largeText ? styles.fill : styles.fit} accessibilityLiveRegion="polite">{body}</ScrollView>
    </Pressable>
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
      {showRune && <Animated.View testID="dialogue-rune-mark" style={[styles.rune, { opacity: rune }]} />}
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} onPress={onDismiss} style={styles.dismiss}>
      <Text accessible={false} allowFontScaling={false} style={styles.dismissMark}>×</Text>
    </Pressable>
  </View>;
}

const wood = '#2b1d13';
const bronze = '#b58a52';
const parchment = '#f0dfb9';
const styles = StyleSheet.create({
  panel: { position: 'absolute', zIndex: 5, backgroundColor: wood, borderColor: bronze, borderWidth: 2, borderRadius: 10, paddingTop: 36,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  // The second bronze line of the frame.
  innerLine: { position: 'absolute', top: 4, right: 4, bottom: 4, left: 4, borderColor: bronze, borderWidth: 1, borderRadius: 7, opacity: 0.6 },
  bust: { position: 'absolute', top: -BUST_RISE, width: BUST, height: BUST, borderRadius: BUST / 2, overflow: 'hidden', backgroundColor: '#44372c', borderColor: bronze, borderWidth: 2 },
  guideCrop: { position: 'absolute', width: 311.3, height: 467, left: -127.7, top: -6.1 },
  portrait: { width: '100%', height: '100%' },
  noPortrait: { flex: 1, backgroundColor: '#3a2c20' },
  plate: { position: 'absolute', top: -13, height: 26, maxWidth: 170, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 4, backgroundColor: '#8a6436', borderColor: '#d8b27a', borderWidth: 1 },
  plateName: { color: '#241609', fontFamily: tokens.font.display, fontSize: 15 },
  touch: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, paddingRight: 44 },
  fill: { flex: 1 },
  // At normal size the panel grows with its text and scrolls only once it reaches its height limit.
  fit: { flexGrow: 0, flexShrink: 1 },
  title: { color: parchment, fontFamily: tokens.font.display, fontSize: 19, marginBottom: 4 },
  text: { color: parchment, fontFamily: tokens.font.body, fontSize: 16, lineHeight: 23 },
  untyped: { color: 'transparent' },
  controls: { flexShrink: 0, paddingHorizontal: 10, paddingBottom: 6 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  actionLabel: { color: '#e7b86e', fontFamily: tokens.font.body, fontSize: 17, fontWeight: '600' },
  step: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6 },
  count: { color: '#c9a77a', fontSize: 12 },
  next: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center' },
  nextMark: { color: '#e7b86e', fontSize: 30 },
  textNext: { height: 44, flexShrink: 1, justifyContent: 'center', paddingHorizontal: 10 },
  nextLabel: { color: '#e7b86e', fontFamily: tokens.font.body, fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  runeTouch: { position: 'absolute', right: 0, bottom: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rune: { width: 12, height: 12, transform: [{ rotate: '45deg' }], backgroundColor: '#f2c37a', shadowColor: '#ffb45a', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  dismiss: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissMark: { color: '#c9a77a', fontSize: 28 },
});
