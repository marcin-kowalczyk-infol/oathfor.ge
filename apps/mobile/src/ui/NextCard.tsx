import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import type { Oath } from '../api/oathSchema';
import { useTranslation } from '../localization/LocalizationProvider';
import { countdownTarget } from '../oaths/countdown';
import { CountdownChip } from '../oaths/CountdownChip';
import type { ServerClock } from '../oaths/serverClock';
import { Action, type ActionProps } from './Action';
import { Disclosure } from './Disclosure';
import { StateSeal } from './StateSeal';
import { Text } from './Text';
import { tokens } from './tokens';

/**
 * The "now and next" card (docs/product/clarity.md "Shared pieces"): seal and state, one line, the countdown when the state has one,
 * at most one action, an optional secondary node and the long facts behind "Pełny opis". A changed state is announced once.
 */
export function NextCard({ oath, clock, line, onElapsed, action, secondary, details }: {
  oath: Pick<Oath, 'state' | 'snapshot' | 'review'>; clock: ServerClock; line: string; onElapsed?: () => void;
  action?: ActionProps; secondary?: ReactNode; details?: ReactNode;
}) {
  const { t } = useTranslation();
  const state = t(`oath.states.${oath.state}`);
  const previous = useRef(oath.state);
  useEffect(() => {
    if (previous.current === oath.state) return;
    previous.current = oath.state;
    AccessibilityInfo.announceForAccessibilityWithOptions(t('common.statusAnnouncement', { heading: state, description: line }), { queue: true });
  }, [oath.state, state, line, t]);
  return <View testID="detail-status" style={styles.panel}>
    <View accessible accessibilityLabel={t('oath.state', { state })} accessibilityLiveRegion="polite" style={styles.state}>
      <StateSeal state={oath.state} size={56} />
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.stateLabel}>{state}</Text>
    </View>
    <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.line}>{line}</Text>
    {countdownTarget(oath) !== null && <CountdownChip oath={oath} clock={clock} size="large" onElapsed={onElapsed} />}
    {action && <Action {...action} />}
    {secondary}
    {details && <View style={styles.details}><Disclosure label={t('path.more')}>{details}</Disclosure></View>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 14, paddingVertical: 20, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, borderColor: '#5b4630', backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  state: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stateLabel: { color: '#edba78', fontFamily: tokens.font.display, fontSize: 20, lineHeight: 28, flexShrink: 1 },
  line: { color: tokens.color.text, fontSize: tokens.body, lineHeight: 25, textAlign: 'center' },
  details: { alignSelf: 'stretch' },
});
