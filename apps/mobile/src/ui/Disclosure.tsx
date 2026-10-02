import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { tokens } from './tokens';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';

/**
 * One link that opens moved text in place (docs/product/clarity.md rules 1 and 2). The label names what opens.
 * The content mounts only while open and keeps its own wrapping text.
 */
export function Disclosure({ label, icon, children, testID, defaultOpen = false, onToggle, heading = false }: {
  label: string; icon?: ReactNode; children: ReactNode; testID?: string;
  /** The label is a section heading, as a tutorial chapter title. The toggle itself takes the header role with its expanded
   * state and a hint that it opens, so VoiceOver finds the heading once (MVP-22-B2b). Its text takes the display cap. */
  heading?: boolean;
  /** Opens on mount, for example when a list returns to the place the player left it. */
  defaultOpen?: boolean;
  /** Reports the state on mount and on every change, so a parent can remember it across a remount. */
  onToggle?(open: boolean): void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { onToggle?.(open); }, [open]);
  return <View style={styles.group}>
    <Pressable testID={testID} accessibilityRole={heading ? 'header' : 'button'} accessibilityLabel={label} accessibilityHint={heading ? t('common.disclosureHint') : undefined}
      accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
      {icon}
      <Text maxFontSizeMultiplier={heading ? tokens.maxScale.display : tokens.maxScale.inset} style={styles.label}>{bindShortWords(label, i18n.language)}</Text>
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
