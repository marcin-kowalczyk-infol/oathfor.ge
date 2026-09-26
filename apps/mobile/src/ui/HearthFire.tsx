import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useMotionAllowed } from './useMotion';

const sheet = require('../../assets/forge/hearth-fire-v01.png');
const frames = [0, 1, 2, 3];

/** Decorative looping flame. Base centre sits on the anchor. Reduced motion shows one still frame. */
export function HearthFire({ anchor, size, opacity = 0.9 }: { anchor: { left: number; top: number }; size: number; opacity?: number }) {
  const motion = useMotionAllowed();
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.stopAnimation(); phase.setValue(0);
    if (!motion) return;
    const loop = Animated.loop(Animated.timing(phase, { toValue: 4, duration: 1500, easing: Easing.linear, isInteraction: false, useNativeDriver: true }));
    loop.start();
    return () => { loop.stop(); phase.stopAnimation(); phase.setValue(0); };
  }, [motion, phase]);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.anchor, { width: size, height: size, left: anchor.left - size / 2, top: anchor.top - size * 0.97, opacity, mixBlendMode: 'screen' }]}>
    {frames.map(frame => <Animated.View key={frame} style={[styles.cell, { width: size, height: size, opacity: phase.interpolate(frame === 0
      ? { inputRange: [0, 1, 3, 4], outputRange: [1, 0, 0, 1], extrapolate: 'clamp' }
      : { inputRange: [frame - 1, frame, frame + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
      <Animated.Image source={sheet} resizeMode="stretch" style={{ position: 'absolute', width: size * 2, height: size * 2, left: -(frame % 2) * size, top: -Math.floor(frame / 2) * size }} />
    </Animated.View>)}
  </View>;
}
const styles = StyleSheet.create({ anchor: { position: 'absolute' }, cell: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' } });
