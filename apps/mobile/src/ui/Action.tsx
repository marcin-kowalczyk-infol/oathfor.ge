import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { tokens } from './tokens';
import { useMotionAllowed } from './useMotion';

export type ActionProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
  /** Secondary only. back draws the chevron before the label, like the other back controls. */
  direction?: 'forward' | 'back';
} & ({ disabled: true; unavailableReason: string } | { disabled?: false; unavailableReason?: string });

export function Action({ label, onPress, disabled = false, busy = false, unavailableReason, variant = 'primary', direction = 'forward' }: ActionProps) {
  const { t, i18n } = useTranslation();
  const motion = useMotionAllowed();
  const depth = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!motion) { depth.stopAnimation(); depth.setValue(0); } return () => depth.stopAnimation(); }, [motion, depth]);
  function press(value: number) {
    depth.stopAnimation();
    if (!motion) { depth.setValue(0); return; }
    Animated.spring(depth, { toValue: value, speed: 32, bounciness: value ? 0 : 5, useNativeDriver: true }).start();
  }
  const unavailable = disabled || busy;
  const reason = unavailableReason ?? (busy ? t('common.working') : undefined);
  const back = variant === 'secondary' && direction === 'back';
  const arrow = <Text allowFontScaling={false} accessible={false} style={[styles.arrow, unavailable && styles.mutedText]}>{back ? '‹' : '›'}</Text>;
  return <View style={styles.group}>
    <Animated.View style={{ transform: [{ translateY: depth.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }, { scale: depth.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) }] }}><Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={unavailable ? reason : undefined}
      accessibilityState={{ disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={() => { if (!unavailable) onPress(); }}
      onPressIn={() => press(1)} onPressOut={() => press(0)}
      style={({ pressed }) => [styles.button, variant === 'primary' ? styles.primary : styles.secondary, back && styles.backward, pressed && styles.pressed, unavailable && styles.unavailable, unavailable && variant === 'primary' && styles.unavailablePrimary]}
    >
      {variant === 'primary' && <Text allowFontScaling={false} accessible={false} style={[styles.sigil, unavailable && styles.mutedText]}>◆</Text>}
      {back && arrow}
      <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel, unavailable && styles.mutedText]}>{label}</Text>
      {variant === 'secondary' && !back && arrow}
    </Pressable></Animated.View>
    {/* The drawn reason keeps Polish single-letter words with the next word. The hint above keeps the plain form. */}
    {unavailable && reason && <Text style={styles.reason}>{bindShortWords(reason, i18n.language)}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: tokens.space.small, alignSelf: 'stretch' },
  button: { minHeight: 56, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: tokens.color.primary, borderBottomWidth: 5, borderBottomColor: '#8c602e', shadowColor: '#d98528', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  secondary: { backgroundColor: 'transparent', justifyContent: 'space-between', paddingHorizontal: 4, minHeight: 48 },
  backward: { justifyContent: 'flex-start' },
  pressed: { opacity: 0.8 }, unavailable: { shadowOpacity: 0 },
  // Native check, 2026-09-30: disabled actions only lost their shadow and read as enabled. The reason under them keeps full contrast.
  // MVP-22-B2 (G17): the muted fill is the warm neutral surface, not slate.
  unavailablePrimary: { backgroundColor: tokens.color.surface, borderBottomColor: tokens.warm.edge }, mutedText: { color: tokens.color.secondary },
  sigil: { color: '#714a25', fontSize: 16 }, arrow: { color: tokens.color.primary, fontSize: 26 },
  label: { fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600', flexShrink: 1 },
  primaryLabel: { color: tokens.color.canvas },
  secondaryLabel: { color: tokens.color.text },
  reason: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
