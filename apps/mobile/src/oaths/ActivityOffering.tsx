import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import type { Activity } from '../api/oathSchema';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { tokens } from '../ui/tokens';
import { useMotionAllowed } from '../ui/useMotion';

/** Illustrated objects select an activity without requesting a preview or consent. */
export function ActivityOffering({ activity, label, selected, disabled, onPress }: {
  activity: Activity; label: string; selected: boolean; disabled: boolean; onPress(): void;
}) {
  const motion = useMotionAllowed();
  const { fontScale } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!motion) { scale.stopAnimation(); scale.setValue(1); }
    return () => scale.stopAnimation();
  }, [motion, scale]);
  function touch(pressed: boolean) {
    scale.stopAnimation();
    if (!motion) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: pressed ? 0.95 : 1, speed: 28, bounciness: 4, useNativeDriver: true }).start();
  }
  const stacked = fontScale > 1.3;
  const art = <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
    <ActivityEmblem activity={activity} size={94} />
  </View>;
  const mark = <Text pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no" style={styles.selection}>{selected ? '✓' : '○'}</Text>;
  return <Animated.View style={[styles.offering, stacked && styles.wide, { transform: [{ scale }] }]}>
    <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled}
      onPress={() => { if (!disabled) onPress(); }} onPressIn={() => touch(true)} onPressOut={() => touch(false)}
      style={({ pressed }) => [styles.object, selected && styles.selected, pressed && styles.pressed, stacked && styles.stacked]}>
      {/* Native check, 2026-09-30: at the largest text size a label between the picture and the marker got about 150 pt,
          so "Bieganie" and "Trening siłowy" broke mid-word. The picture and the marker share a line, the label gets the full width. */}
      {stacked ? <View style={styles.top}>{art}{mark}</View> : art}
      <Text style={[styles.label, stacked && styles.stackedLabel]}>{label}</Text>
      {!stacked && mark}
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  offering: { flex: 1, minWidth: 90 }, wide: { flexBasis: '100%' },
  object: { flex: 1, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 12, borderRadius: 24, gap: 8, backgroundColor: 'rgba(20, 19, 17, 0.76)' },
  selected: { backgroundColor: 'rgba(85, 55, 29, 0.88)', shadowColor: '#eea54a', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  pressed: { backgroundColor: '#704821' }, stacked: { alignItems: 'stretch', paddingHorizontal: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  art: { width: 94, height: 94, alignItems: 'center', justifyContent: 'center' },
  label: { color: tokens.color.text, fontSize: 16, lineHeight: 23, textAlign: 'center', fontWeight: '600', flexShrink: 1 },
  stackedLabel: { textAlign: 'left', alignSelf: 'stretch' },
  selection: { color: '#ffc574', fontSize: 18, lineHeight: 22, textAlign: 'center' },
});
