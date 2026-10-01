import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { tokens } from './tokens';

/** Plain back control without artwork, matching the back buttons of Settings, the pause review and the character screens. */
/** hint: what pressing does, when the label names only the destination. */
export function BackLink({ label, onPress, hint }: { label: string; onPress(): void; hint?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
    <Text allowFontScaling={false} style={styles.arrow}>‹</Text>
    <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.label}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, alignSelf: 'flex-start', paddingRight: 12 },
  pressed: { opacity: 0.85 },
  arrow: { color: tokens.color.primary, fontSize: 30, lineHeight: 32 },
  label: { color: '#e5d4b2', fontFamily: tokens.font.display, fontSize: 17, lineHeight: 24, flexShrink: 1 },
});
