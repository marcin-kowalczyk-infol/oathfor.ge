import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { tokens } from './tokens';

/**
 * One link that opens moved text in place (docs/product/clarity.md rules 1 and 2). The label names what opens.
 * The content mounts only while open and keeps its own wrapping text.
 */
export function Disclosure({ label, icon, children, testID, defaultOpen = false, onToggle }: {
  label: string; icon?: ReactNode; children: ReactNode; testID?: string;
  /** Opens on mount, for example when a list returns to the place the player left it. */
  defaultOpen?: boolean;
  /** Reports the state on mount and on every change, so a parent can remember it across a remount. */
  onToggle?(open: boolean): void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { onToggle?.(open); }, [open]);
  return <View style={styles.group}>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
      {icon}
      <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.label}>{label}</Text>
      <Text accessible={false} maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.mark}>{open ? '▴' : '▾'}</Text>
    </Pressable>
    {open && children}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: tokens.space.card },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: tokens.radius, backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  label: { flex: 1, color: tokens.color.text, fontSize: tokens.body, fontWeight: '600' },
  mark: { color: tokens.color.primary, fontSize: 18 },
  pressed: { opacity: 0.75 },
});
