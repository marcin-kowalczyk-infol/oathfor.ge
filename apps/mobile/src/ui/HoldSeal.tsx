import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useArt } from '../art/ArtProvider';
import { SpriteFrame } from '../forge/Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { Text } from './Text';
import { tokens } from './tokens';
import { useMotionAllowed } from './useMotion';

/** The hold that fills the ring (engagement.md E3 "Hold rules", local decision). */
export const HOLD_MS = 1000;
const TICKS = 24;
// The size of the seal with its ring. The wax takes 260 of the art's 360 px cell (MVP-22-E3.4 handoff), the ring sits outside it.
const SEAL = 120;
const WAX = Math.round(SEAL * 260 / 360);
const TICK = { width: 4, height: 9 };
const RING_RADIUS = SEAL / 2 - TICK.height / 2 - 2;
const DIM = 0.22;
// A finger may wander this far past the control before the hold cancels, close to Pressable's retention (local decision).
const SLOP = 16;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
const activate = [{ name: 'activate' }] as const;

type Phase = 'idle' | 'holding' | 'full';
const FRAME: Record<Phase, number> = { idle: 0, holding: 1, full: 2 };

export type HoldSealProps = {
  /** The stored text drawn in full as the label: the promise on the rules review (D-E1, corrected 2026-10-02), the declaration on the proof form once E6 adopts it (D-E11). */
  label: string;
  /** Called once on release after a full hold, or on the accessibility activate action. */
  onSeal: () => void;
  /** The action named after the label for a screen reader. Defaults to the Oath's "Złóż Przysięgę". */
  actionLabel?: string;
  /** The drawn hint, for example the proof form's "Przytrzymaj, by wysłać dowód". */
  hint?: string;
  /** The drawn hint while a screen reader runs, and the spoken hint. */
  tapHint?: string;
  busy?: boolean;
} & ({ disabled: true; unavailableReason: string } | { disabled?: false; unavailableReason?: string });

/** True while VoiceOver or TalkBack runs. False until known, so the hold hint is drawn first. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    let known = false;
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', value => { known = true; if (mounted) setEnabled(value); });
    void AccessibilityInfo.isScreenReaderEnabled().then(value => {
      // A change event is newer than the async startup snapshot.
      if (mounted && !known) setEnabled(value);
    }).catch(() => { /* Keep the hold hint if the state is unavailable. */ });
    return () => { mounted = false; listener.remove(); };
  }, []);
  return enabled;
}

/** The label a screen reader reads: the drawn label, a stop, then the action. */
function spoken(drawn: string, action: string) {
  const text = drawn.trim();
  return /[.!?…]$/.test(text) ? `${text} ${action}` : `${text}. ${action}`;
}

/**
 * The press-and-hold seal of the rules review (docs/product/engagement.md E3, D-E1, D-E5). Holding fills a ring over
 * 1.0 s. Only a release after the full ring calls onSeal. An early release, a slide off the control or a scroll that takes
 * the touch cancels and the ring empties (WCAG 2.1, 2.5.2). The whole control is one button with the activate action,
 * so the VoiceOver double tap and Switch Control select seal without holding. Reduce Motion shows the full ring in one
 * change at 1.0 s. The ring is drawn in code. The wax too, until the E3.5 hookup gives the registry a sheet.
 */
export function HoldSeal({ label: drawnLabel, onSeal, actionLabel, hint, tapHint, busy = false, disabled = false, unavailableReason }: HoldSealProps) {
  const { t, i18n } = useTranslation();
  const art = useArt().oaths.holdSeal;
  const motion = useMotionAllowed();
  const screenReader = useScreenReaderEnabled();
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const size = useRef<{ width: number; height: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const sealRef = useRef(onSeal); sealRef.current = onSeal;
  const unavailable = disabled || busy;

  const move = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    progress.stopAnimation();
    progress.setValue(0);
    if (phaseRef.current !== 'idle') move('idle');
  }, [move, progress]);

  useEffect(() => { if (unavailable) cancel(); }, [unavailable, cancel]);
  useEffect(() => cancel, [cancel]);

  function grant(event: GestureResponderEvent) {
    if (unavailable) return;
    cancel();
    // The control is the only touch target (box-only), so location is relative to it. The origin turns later page
    // positions into local ones.
    const { pageX, pageY, locationX, locationY } = event.nativeEvent;
    origin.current = { x: pageX - locationX, y: pageY - locationY };
    move('holding');
    if (motion) Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      progress.stopAnimation();
      progress.setValue(1);
      move('full');
    }, HOLD_MS);
  }

  function slide(event: GestureResponderEvent) {
    if (phaseRef.current === 'idle' || !size.current) return;
    const x = event.nativeEvent.pageX - origin.current.x;
    const y = event.nativeEvent.pageY - origin.current.y;
    if (x < -SLOP || y < -SLOP || x > size.current.width + SLOP || y > size.current.height + SLOP) cancel();
  }

  function end() {
    const full = phaseRef.current === 'full';
    cancel();
    if (full && !unavailable) sealRef.current();
  }

  function action(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName !== 'activate' || unavailable) return;
    cancel();
    sealRef.current();
  }

  const label = spoken(drawnLabel, actionLabel ?? t('oath.confirm'));
  const tap = tapHint ?? t('oath.holdTapHint');
  const drawnHint = screenReader ? tap : (hint ?? t('oath.holdHint'));
  const reason = unavailableReason ?? (busy ? t('common.working') : undefined);

  return <View
    testID="hold-seal"
    accessible
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={unavailable ? reason : tap}
    accessibilityState={{ disabled: unavailable, busy }}
    accessibilityActions={activate}
    onAccessibilityAction={action}
    pointerEvents="box-only"
    onLayout={(event: LayoutChangeEvent) => { const { width, height } = event.nativeEvent.layout; size.current = { width, height }; }}
    onStartShouldSetResponder={() => true}
    onResponderTerminationRequest={() => true}
    onResponderGrant={grant}
    onResponderMove={slide}
    onResponderRelease={end}
    onResponderTerminate={cancel}
    style={[styles.control, unavailable && styles.unavailable]}
  >
    <View {...hidden} testID={`hold-seal-${phase}`} style={styles.seal}>
      {Array.from({ length: TICKS }, (_, index) => <Animated.View key={index} testID="hold-seal-tick" style={[styles.tick, {
        opacity: progress.interpolate({ inputRange: [index / TICKS, (index + 1) / TICKS], outputRange: [DIM, 1], extrapolate: 'clamp' }),
        transform: [{ rotate: `${(360 / TICKS) * index}deg` }, { translateY: -RING_RADIUS }],
      }]} />)}
      {art
        ? <SpriteFrame sheet={art} index={FRAME[phase]} width={WAX} testID={`hold-seal-art-${FRAME[phase]}`} />
        // DUMMY until MVP-22-E3.5: the code wax. Red wax as in seal-stamp, the ring stays gold (D-E3, no red for a state).
        : <View testID="hold-seal-wax" style={styles.wax}>
          <View style={[styles.well, phase !== 'idle' && styles.pressed, phase === 'full' && styles.full]} />
        </View>}
    </View>
    {/* Inset caps as the consent and cards around it on the review, so long Polish words stay whole at the largest size. */}
    <Text budget="declaration" maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.label, unavailable && styles.muted]}>{bindShortWords(drawnLabel, i18n.language)}</Text>
    <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.hint}>{bindShortWords(unavailable && reason ? reason : drawnHint, i18n.language)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  control: { alignSelf: 'stretch', alignItems: 'center', gap: tokens.space.item, paddingVertical: tokens.space.small, minHeight: 44, minWidth: 44 },
  unavailable: { opacity: 0.72 },
  seal: { width: SEAL, height: SEAL, alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', left: SEAL / 2 - TICK.width / 2, top: SEAL / 2 - TICK.height / 2, width: TICK.width, height: TICK.height, borderRadius: TICK.width / 2, backgroundColor: tokens.warm.bright },
  wax: { width: WAX, height: WAX, borderRadius: WAX / 2, backgroundColor: '#8f2618', borderWidth: 3, borderColor: '#5e150c', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  well: { width: WAX * 0.62, height: WAX * 0.62, borderRadius: WAX * 0.31, backgroundColor: '#a3301f', borderWidth: 2, borderColor: '#b84a35' },
  pressed: { backgroundColor: '#741d12', borderColor: '#4f120a' },
  full: { backgroundColor: '#c8642a', borderColor: tokens.warm.bright },
  label: { color: tokens.color.text, fontFamily: tokens.font.display, fontSize: tokens.body, lineHeight: tokens.body * 1.5, textAlign: 'center' },
  muted: { color: tokens.color.secondary },
  hint: { color: tokens.color.secondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
