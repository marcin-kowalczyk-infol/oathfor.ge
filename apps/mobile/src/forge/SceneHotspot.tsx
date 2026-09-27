import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

/** Light belongs to the scene; the stationary touch area never scales with it. */
export function SceneHotspot({ label, hint, selected, onPress, anchor, door = false, allowed, glow, heard }: {
  label: string; hint?: string; selected?: boolean; onPress: () => void;
  anchor: { left: number; top: number }; door?: boolean; allowed: boolean; glow: Animated.Value; heard?: string;
}) {
  const ripple = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [touch, setTouch] = useState({ x: 38, y: 36 });
  const color = door ? '#c2efff' : '#ffdb8c';
  useEffect(() => {
    if (!allowed) { animation.current?.stop(); ripple.setValue(1); }
    return () => { animation.current?.stop(); };
  }, [allowed, ripple]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={{ selected }} onPress={onPress}
    onPressIn={({ nativeEvent }) => {
      if (!allowed) return;
      setTouch({ x: nativeEvent.locationX, y: nativeEvent.locationY });
      animation.current?.stop();
      ripple.setValue(0);
      animation.current = Animated.timing(ripple, { toValue: 1, duration: 520, isInteraction: false, useNativeDriver: true });
      animation.current.start();
    }}
    style={[door ? styles.door : styles.station, anchor]}>
    {({ pressed }) => <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cueLayer}>
      <Animated.View style={[styles.cueMote, { backgroundColor: color, shadowColor: color,
        opacity: pressed || selected ? 1 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{ translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { rotate: '45deg' }] }]} />
      <Animated.View style={[styles.touchRing, { left: touch.x - 22, top: touch.y - 22, borderColor: color, shadowColor: color,
        opacity: ripple.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.95, 0.75, 0] }),
        transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.8] }) }] }]} />
      {heard && <View testID={heard} style={styles.heard}><Text allowFontScaling={false} style={styles.heardMark}>✓</Text></View>}
    </View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  // Native check: a bare check mark faded into the hearth glow, so a heard place gets a gold badge beside its mote.
  heard: { position: 'absolute', top: -3, left: '50%', marginLeft: 7, width: 17, height: 17, borderRadius: 8.5, backgroundColor: '#f0c987', borderWidth: 1, borderColor: '#5d3616',
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  heardMark: { color: '#3a2412', fontSize: 11, lineHeight: 13, fontWeight: '800' },
  station: { position: 'absolute', width: 76, height: 72, marginLeft: -38, marginTop: -36, borderRadius: 30, zIndex: 2 },
  cueLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cueMote: { position: 'absolute', width: 5, height: 5, top: 4, alignSelf: 'center', shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  touchRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  door: { position: 'absolute', width: 60, height: 96, marginLeft: -30, marginTop: -48, zIndex: 2 },
});
