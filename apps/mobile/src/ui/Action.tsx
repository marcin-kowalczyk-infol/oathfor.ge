import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { tokens } from './tokens';

export type ActionProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
} & ({ disabled: true; unavailableReason: string } | { disabled?: false; unavailableReason?: string });

export function Action({ label, onPress, disabled = false, busy = false, unavailableReason, variant = 'primary' }: ActionProps) {
  const { t } = useTranslation();
  const unavailable = disabled || busy;
  const reason = unavailableReason ?? (busy ? t('common.working') : undefined);
  return <View style={styles.group}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={unavailable ? reason : undefined}
      accessibilityState={{ disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={() => { if (!unavailable) onPress(); }}
      style={[styles.button, variant === 'primary' ? styles.primary : styles.secondary]}
    >
      <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
    </Pressable>
    {unavailable && reason && <Text style={styles.reason}>{reason}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: tokens.space.small, alignSelf: 'stretch' },
  button: { minHeight: tokens.controlHeight, borderRadius: tokens.radius, padding: tokens.space.item, borderWidth: 1, justifyContent: 'center' },
  primary: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  secondary: { backgroundColor: tokens.color.surface, borderColor: tokens.color.neutral },
  label: { fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600', flexShrink: 1 },
  primaryLabel: { color: tokens.color.canvas },
  secondaryLabel: { color: tokens.color.text },
  reason: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
