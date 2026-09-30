import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { tokens } from './tokens';
import { useMotionAllowed } from './useMotion';

/** Mounted only after the controller supplies an accepted Oath. This is a seal, not an XP award. */
export function CommitMark() {
  const motion = useMotionAllowed();
  const played = useRef(false);
  const stamp = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!motion) { stamp.stopAnimation(); stamp.setValue(1); return; }
    if (played.current) return;
    played.current = true;
    stamp.setValue(0.65);
    const animation = Animated.spring(stamp, { toValue: 1, speed: 10, bounciness: 11, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [motion, stamp]);
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.center}>
    <Animated.View style={[styles.seal, { transform: [{ scale: stamp }] }]}><View style={styles.rim}><Text allowFontScaling={false} style={styles.mark}>◆</Text></View></Animated.View>
  </View>;
}
const styles = StyleSheet.create({ center: { alignItems: 'center', paddingVertical: 12 }, seal: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: tokens.color.primary, borderBottomWidth: 5, borderBottomColor: '#80592c', backgroundColor: '#3e3021', alignItems: 'center', justifyContent: 'center' }, rim: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: '#785a34', alignItems: 'center', justifyContent: 'center' }, mark: { fontSize: 36, color: tokens.color.primary } });
