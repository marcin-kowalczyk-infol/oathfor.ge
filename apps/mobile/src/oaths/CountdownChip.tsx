import { Image, StyleSheet, Text, View } from 'react-native';
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
export function CountdownChip({ oath, clock, size = 'small', onElapsed }: { oath: Pick<Oath, 'state' | 'snapshot' | 'review'>; clock: ServerClock; size?: 'small' | 'large'; onElapsed?: () => void }) {
  const { t } = useTranslation();
  const motion = useMotionAllowed();
  const target = countdownTarget(oath);
  const remaining = useCountdown(target, clock, onElapsed);
  if (!target || remaining === null) return null;
  const text = formatCountdown(remaining, t, target.kind === 'start' ? 'accusative' : 'nominative');
  const prefix = t(`countdown.${target.kind}`);
  const large = size === 'large';
  const icon = large ? 44 : 22;
  return <View testID="countdown-chip" accessible accessibilityLabel={text.elapsed ? text.spoken : `${prefix} ${text.spoken}`} style={[styles.chip, large && styles.large, text.elapsed && styles.elapsed]}>
    {large && motion && !text.elapsed
      ? <SpriteLoop sheet={oathArt.hourglass} width={icon} duration={1000} allowed testID="countdown-hourglass" />
      : <Image source={oathArt.hourglassStill} style={{ width: icon, height: icon }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
    <View style={styles.texts}>
      {!text.elapsed && <Text style={[styles.prefix, large && styles.largePrefix]}>{prefix}</Text>}
      <Text style={[styles.value, large && styles.largeValue, text.elapsed && styles.elapsedText]}>{text.short}</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', flexShrink: 1, gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#3a2a1a', borderWidth: 1, borderColor: '#b58a52' },
  large: { gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  elapsed: { backgroundColor: tokens.color.surface, borderColor: tokens.color.secondary },
  texts: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  prefix: { color: tokens.color.secondary, fontSize: 14 }, largePrefix: { fontSize: 17 },
  value: { color: tokens.color.primary, fontSize: 15, fontWeight: '700' }, largeValue: { fontSize: 28 },
  elapsedText: { color: tokens.color.secondary },
});
