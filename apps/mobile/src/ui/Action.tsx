import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { tokens } from './tokens';
import { useMotionAllowed } from './useMotion';

export type ActionProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
} & ({ disabled: true; unavailableReason: string } | { disabled?: false; unavailableReason?: string });

export function Action({ label, onPress, disabled = false, busy = false, unavailableReason, variant = 'primary' }: ActionProps) {
  const { t } = useTranslation();
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
  return <View style={styles.group}>
    <Animated.View style={{ transform: [{ translateY: depth.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }, { scale: depth.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) }] }}><Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={unavailable ? reason : undefined}
      accessibilityState={{ disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={() => { if (!unavailable) onPress(); }}
      onPressIn={() => press(1)} onPressOut={() => press(0)}
      style={({ pressed }) => [styles.button, variant === 'primary' ? styles.primary : styles.secondary, pressed && styles.pressed, unavailable && styles.unavailable]}
    >
      {variant === 'primary' && <Text allowFontScaling={false} accessible={false} style={styles.sigil}>◆</Text>}
      <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
      {variant === 'secondary' && <Text allowFontScaling={false} accessible={false} style={styles.arrow}>›</Text>}
    </Pressable></Animated.View>
    {unavailable && reason && <Text style={styles.reason}>{reason}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: tokens.space.small, alignSelf: 'stretch' },
  button: { minHeight: 56, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: tokens.color.primary, borderBottomWidth: 5, borderBottomColor: '#8c602e', shadowColor: '#d98528', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  secondary: { backgroundColor: 'transparent', justifyContent: 'space-between', paddingHorizontal: 4, minHeight: 48 },
  pressed: { opacity: 0.8 }, unavailable: { shadowOpacity: 0 },
  sigil: { color: '#714a25', fontSize: 16 }, arrow: { color: tokens.color.primary, fontSize: 26 },
  label: { fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600', flexShrink: 1 },
  primaryLabel: { color: tokens.color.canvas },
  secondaryLabel: { color: tokens.color.text },
  reason: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
