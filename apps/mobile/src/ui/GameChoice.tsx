import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from './tokens';
import { useMotionAllowed } from './useMotion';

/** A choice remains an explicit radio action; motion never submits a form. */
export function GameChoice({ label, symbol, selected, disabled, onPress }: { label: string; symbol: string; selected: boolean; disabled: boolean; onPress(): void }) {
  const motion = useMotionAllowed();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!motion) { scale.stopAnimation(); scale.setValue(1); } return () => scale.stopAnimation(); }, [motion, scale]);
  function touch(pressed: boolean) {
    scale.stopAnimation();
    if (!motion) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: pressed ? 0.96 : 1, speed: 30, bounciness: 5, useNativeDriver: true }).start();
  }
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable accessibilityRole="radio" accessibilityLabel={label}
    accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => { if (!disabled) onPress(); }} onPressIn={() => touch(true)} onPressOut={() => touch(false)}
    style={({ pressed }) => [styles.choice, selected && styles.selected, pressed && styles.pressed]}>
    <View style={[styles.medallion, selected && styles.lit]} accessible={false}><Text allowFontScaling={false} style={styles.symbol}>{symbol}</Text></View>
    <Text style={styles.label}>{label}</Text>
    <Text allowFontScaling={false} accessible={false} style={[styles.mark, selected && styles.selectedMark]}>{selected ? '◆' : '◇'}</Text>
  </Pressable></Animated.View>;
}
const styles = StyleSheet.create({
  choice: { minHeight: 72, padding: 12, gap: 14, borderRadius: 22, backgroundColor: '#202629', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#0e1113' },
  selected: { backgroundColor: '#3c3023', borderBottomColor: '#896037' }, pressed: { backgroundColor: '#4c3a27' },
  medallion: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#30373b' },
  lit: { backgroundColor: '#775029' }, symbol: { color: tokens.color.primary, fontSize: 26 },
  label: { color: tokens.color.text, fontSize: 17, lineHeight: 25, fontWeight: '600', flex: 1 },
  mark: { color: tokens.color.secondary, fontSize: 20 }, selectedMark: { color: tokens.color.primary },
});
