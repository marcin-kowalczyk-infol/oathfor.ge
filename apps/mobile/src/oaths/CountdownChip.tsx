import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Oath } from '../api/oathSchema';
import { SpriteLoop } from '../forge/Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { tokens } from '../ui/tokens';
import { useMotionAllowed } from '../ui/useMotion';
import { countdownTarget, formatCountdown } from './countdown';
import { oathArt } from './oathArt';
import type { ServerClock } from './serverClock';
import { useCountdown } from './useCountdown';

/** Time left for an Oath from server time. Hidden without server time or for states without a countdown. */
/** stacked: the label sits over one unbroken value, for narrow seal columns that must line up side by side. */
export function CountdownChip({ oath, clock, size = 'small', stacked = false, onElapsed }: { oath: Pick<Oath, 'state' | 'snapshot' | 'review'>; clock: ServerClock; size?: 'small' | 'large'; stacked?: boolean; onElapsed?: () => void }) {
  const { t } = useTranslation();
  const motion = useMotionAllowed();
  const { fontScale } = useWindowDimensions();
  const target = countdownTarget(oath);
  const remaining = useCountdown(target, clock, onElapsed);
  if (!target || remaining === null) return null;
  const text = formatCountdown(remaining, t, target.kind === 'start' ? 'accusative' : 'nominative');
  const prefix = t(`countdown.${target.kind}`);
  const large = size === 'large';
  const icon = large ? 44 : 22;
  const label = `${prefix} ${text.spoken}`;
  if (stacked) return <View testID="countdown-chip" accessible accessibilityLabel={text.elapsed ? text.spoken : label} style={[styles.chip, styles.stacked, text.elapsed && styles.elapsed]}>
    {!text.elapsed && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.stackedPrefix}>{prefix}</Text>}
    <View style={styles.stackedValue}>
      <Image source={oathArt.hourglassStill} style={styles.stackedIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.value, styles.stackedValueText, text.elapsed && styles.elapsedText]}>{text.short}</Text>
    </View>
  </View>;
  return <View testID="countdown-chip" accessible accessibilityLabel={text.elapsed ? text.spoken : label} style={[styles.chip, large && styles.large, text.elapsed && styles.elapsed]}>
    {/* A sprite loop is absolutely placed, so this box reserves its room. Native check: the label slid under it. */}
    <View testID="countdown-icon" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: icon, height: icon }}>
      {large && motion && !text.elapsed
        ? <SpriteLoop sheet={oathArt.hourglass} width={icon} duration={1000} allowed testID="countdown-hourglass" />
        : <Image source={oathArt.hourglassStill} style={{ width: icon, height: icon }} />}
    </View>
    {/* Native check at large text: a wrapped row stretched the chip to full width, while a column hugs its widest line. Every chip stacks, so rows match. */}
    <View testID="countdown-texts" style={[styles.texts, fontScale > 1.3 && styles.textsStacked]}>
      {!text.elapsed && <Text style={[styles.prefix, large && styles.largePrefix]}>{prefix}</Text>}
      <Text style={[styles.value, large && styles.largeValue, text.elapsed && styles.elapsedText]}>{text.short}</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', flexShrink: 1, gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#3a2a1a', borderWidth: 1, borderColor: '#b58a52' },
  // The hourglass art carries about 9pt of clear margin on each side, so the gap and left padding are trimmed to look even.
  large: { alignSelf: 'center', gap: 4, paddingVertical: 10, paddingLeft: 8, paddingRight: 18, borderRadius: 20 },
  elapsed: { backgroundColor: tokens.color.surface, borderColor: tokens.color.secondary },
  texts: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  textsStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  prefix: { color: tokens.color.secondary, fontSize: 14 }, largePrefix: { fontSize: 17 },
  value: { color: tokens.color.primary, fontSize: 15, fontWeight: '700' }, largeValue: { fontSize: 28 },
  elapsedText: { color: tokens.color.secondary },
  stacked: { flexDirection: 'column', alignSelf: 'stretch', gap: 2, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12 },
  stackedPrefix: { color: tokens.color.secondary, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  stackedValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, maxWidth: '100%' },
  stackedIcon: { width: 18, height: 18 },
  // A fixed line height keeps every seal chip the same height when a long label shrinks to fit.
  stackedValueText: { flexShrink: 1, lineHeight: 20 },
});
