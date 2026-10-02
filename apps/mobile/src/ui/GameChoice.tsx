import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { tokens } from './tokens';
import { useMotionAllowed } from './useMotion';

/** A choice remains an explicit radio action; motion never submits a form. */
export function GameChoice({ label, symbol, selected, disabled, onPress, stacked = false }: { label: string; symbol: string; selected: boolean; disabled: boolean; onPress(): void; /** Large text: the medallion and the marker share a line and the label gets the full width below. */ stacked?: boolean }) {
  const { i18n } = useTranslation();
  const motion = useMotionAllowed();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!motion) { scale.stopAnimation(); scale.setValue(1); } return () => scale.stopAnimation(); }, [motion, scale]);
  function touch(pressed: boolean) {
    scale.stopAnimation();
    if (!motion) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: pressed ? 0.96 : 1, speed: 30, bounciness: 5, useNativeDriver: true }).start();
  }
  const medallion = <View testID="choice-medallion" style={[styles.medallion, selected && styles.lit]} accessible={false}><Text allowFontScaling={false} style={styles.symbol}>{symbol}</Text></View>;
  const mark = <Text allowFontScaling={false} accessible={false} style={[styles.mark, selected && styles.selectedMark]}>{selected ? '◆' : '◇'}</Text>;
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable accessibilityRole="radio" accessibilityLabel={label}
    accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => { if (!disabled) onPress(); }} onPressIn={() => touch(true)} onPressOut={() => touch(false)}
    style={({ pressed }) => [styles.choice, selected && styles.selected, pressed && styles.pressed, stacked && styles.stacked]}>
    {stacked ? <View style={styles.top}>{medallion}{mark}</View> : medallion}
    <Text style={[styles.label, stacked ? styles.stackedLabel : styles.rowLabel]}>{bindShortWords(label, i18n.language)}</Text>
    {!stacked && mark}
  </Pressable></Animated.View>;
}
const styles = StyleSheet.create({
  // MVP-22-B2 (G17): an idle choice stands on the warm neutral surface, its medallion on the raised warm fill.
  choice: { minHeight: 72, padding: 12, gap: 14, borderRadius: 22, backgroundColor: tokens.color.surface, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: tokens.warm.edge },
  selected: { backgroundColor: '#3c3023', borderBottomColor: '#896037' }, pressed: { backgroundColor: '#4c3a27' },
  medallion: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.warm.raised },
  lit: { backgroundColor: '#775029' }, symbol: { color: tokens.color.primary, fontSize: 26 },
  label: { color: tokens.color.text, fontSize: 17, lineHeight: 25, fontWeight: '600' }, rowLabel: { flex: 1 },
  stacked: { flexDirection: 'column', alignItems: 'stretch' }, stackedLabel: { alignSelf: 'stretch' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mark: { color: tokens.color.secondary, fontSize: 20 }, selectedMark: { color: tokens.color.primary },
});
