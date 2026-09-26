import { Pressable, StyleSheet, Text } from 'react-native';
import { tokens } from './tokens';

/** Plain back control without artwork, matching the back buttons of Settings, the pause review and the character screens. */
export function BackLink({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
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
