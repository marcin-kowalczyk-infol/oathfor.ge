import { StyleSheet, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { Text } from './Text';
import { tokens } from './tokens';

export type PauseMarkState = 'active' | 'paused' | 'unknown';

/**
 * The character's pause state as a shape and a visible label (docs/product/clarity.md rules 4 and 5, "Pause mark").
 * In play is a filled seal, paused two bars, unknown a hollow ring. None of them is red.
 */
export function PauseMark({ state }: { state: PauseMarkState }) {
  const { t } = useTranslation();
  const label = t(`pauseMark.${state}`);
  return <View testID="pause-mark" accessible accessibilityLabel={label} style={styles.mark}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.shape}>
      {state === 'active' && <View testID="pause-mark-seal" style={styles.seal} />}
      {state === 'paused' && <View testID="pause-mark-bars" style={styles.bars}><View style={styles.bar} /><View style={styles.bar} /></View>}
      {state === 'unknown' && <View testID="pause-mark-ring" style={styles.ring} />}
    </View>
    <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.label}>{label}</Text>
  </View>;
}

const SIZE = 14;
const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  shape: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  seal: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: tokens.color.positive, borderWidth: 1, borderColor: 'rgba(214,170,105,0.55)' },
  bars: { flexDirection: 'row', gap: 3, height: SIZE },
  bar: { width: 4, height: SIZE, borderRadius: 1, backgroundColor: tokens.color.neutral },
  ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: tokens.color.secondary },
  label: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, flexShrink: 1 },
});
