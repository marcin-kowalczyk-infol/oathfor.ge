import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/** Decorative responses never delay navigation or alter committed state. */
export function StationEffect({ station, request, allowed, anchor }: {
  station: 'hearth' | 'seals' | 'chronicle'; request: number; allowed: boolean;
  anchor: { left: number; top: number };
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const consumed = useRef<number | null>(null);
  useEffect(() => {
    if (consumed.current === request) { progress.setValue(1); return; }
    consumed.current = request;
    if (!allowed) { progress.setValue(1); return; }
    progress.setValue(0);
    const response = Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), isInteraction: false, useNativeDriver: true });
    response.start();
    return () => { response.stop(); progress.stopAnimation(); };
  }, [allowed, progress, request, station]);
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.65, 1], outputRange: [0, 0.85, 0.55, 0] });
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.anchor, anchor]}>
    {station === 'hearth' && <>
      <Animated.Image source={require('../assets/forge/ember-haze-v01.png')} style={[styles.flare, { opacity, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, -36] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] }) }] }]} />
      {[0, 1, 2, 3, 4, 5].map(index => <Animated.View key={index} style={[styles.ember, { opacity, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, (index - 2.5) * 13] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, -35 - index % 3 * 15] }) }] }]} />)}
    </>}
    {station === 'chronicle' && [0, 1, 2].map(index => <Animated.View key={index} style={[styles.page, { opacity, transform: [{ perspective: 240 }, { rotateZ: '-12deg' }, { rotateY: progress.interpolate({ inputRange: [0, 0.22 + index * 0.14, 1], outputRange: ['0deg', '-90deg', '-175deg'] }) }] }]} />)}
    {station === 'seals' && [0, 1, 2].map(index => <Animated.View key={index} style={[styles.rune, { left: (index - 1) * 16, top: index % 2 * 9, opacity, transform: [{ perspective: 200 }, { rotateY: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }, { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -9, 0] }) }] }]}>
      <View style={styles.runeStem} /><View style={styles.runeBranch} />
    </Animated.View>)}
  </View>;
}
const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
  flare: { position: 'absolute', width: 170, height: 180, left: -85, top: -100, tintColor: '#ffc15a' },
  ember: { position: 'absolute', width: 2, height: 5, borderRadius: 2, backgroundColor: '#ffdc91', shadowColor: '#ffa735', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  page: { position: 'absolute', width: 17, height: 23, top: -12, left: 0, backgroundColor: '#d6bd85', borderColor: '#987744', borderWidth: 0.5, transformOrigin: 'left center' },
  rune: { position: 'absolute', width: 10, height: 18 },
  runeStem: { position: 'absolute', width: 2, height: 16, backgroundColor: '#ffd38a', shadowColor: '#ffc167', shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  runeBranch: { position: 'absolute', width: 2, height: 10, left: 3, top: 0, backgroundColor: '#ffd38a', transform: [{ rotate: '-40deg' }] },
});
