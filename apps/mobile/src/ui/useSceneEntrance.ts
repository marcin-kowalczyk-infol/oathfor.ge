import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useMotionAllowed } from './useMotion';

/** A short presentation transition, with no delayed navigation or domain callbacks. */
export function useSceneEntrance(scene: string) {
  const motion = useMotionAllowed();
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (!motion) { progress.setValue(1); return; }
    progress.setValue(0);
    const transition = Animated.timing(progress, { toValue: 1, duration: 190, useNativeDriver: true, isInteraction: false });
    transition.start();
    return () => transition.stop();
  }, [scene, motion, progress]);
  return { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
}
