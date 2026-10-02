import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from './tokens';

/** Eight strips from nearly the band's colour to almost clear. Solid strips, because gradients were unreliable on iOS (MVP-22-T12c). */
export const FADE_STEPS = [0.9, 0.76, 0.62, 0.49, 0.37, 0.26, 0.16, 0.07];

/**
 * A fade drawn as solid strips of one colour that thin out. from: the edge where the fade is strongest.
 * Decoration only, so it never takes a touch and VoiceOver skips it.
 */
export function FadeStrips({ testID, stripTestID, from = 'top', color = tokens.color.canvas, style }: {
  testID: string; stripTestID: string; from?: 'top' | 'bottom'; color?: string; style?: StyleProp<ViewStyle>;
}) {
  const steps = from === 'top' ? FADE_STEPS : [...FADE_STEPS].reverse();
  return <View testID={testID} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
    {steps.map(opacity => <View key={opacity} testID={stripTestID} style={[styles.strip, { opacity, backgroundColor: color }]} />)}
  </View>;
}
const styles = StyleSheet.create({ strip: { flex: 1 } });
