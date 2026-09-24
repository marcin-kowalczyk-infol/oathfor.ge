import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { Action, ActionProps } from './Action';
import { tokens } from './tokens';

export type Status = 'proof_pending' | 'needs_more_evidence' | 'review_pending' | 'fulfilled' | 'missed' | 'recovered' | 'unresolved' | 'withdrawn';
export type StatusCardProps = { status: Status; detail?: string; action?: ActionProps };

const markers: Record<Status, string> = { proof_pending: '◷', needs_more_evidence: '▤', review_pending: '⌕', fulfilled: '✓', missed: '—', recovered: '↶', unresolved: '○', withdrawn: 'Ⅱ' };

export function StatusCard({ status, detail, action }: StatusCardProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const heading = t(`status.${status}.heading`);
  const description = t(`status.${status}.description`);
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current !== status) {
      AccessibilityInfo.announceForAccessibilityWithOptions(t('common.statusAnnouncement', { heading, description }), { queue: true });
      previous.current = status;
    }
  }, [status, heading, description, t]);
  const color = status === 'missed' ? tokens.color.missed
    : status === 'fulfilled' || status === 'recovered' ? tokens.color.positive : tokens.color.neutral;
  const headingSize = fontScale >= 1.5 ? tokens.body : 22;
  return <View style={[styles.card, { borderLeftColor: color }]}>
    <View style={styles.headingRow}>
      <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no" style={[styles.body, { color }]}>{markers[status]}</Text>
      <Text accessibilityRole="header" style={[styles.heading, { fontSize: headingSize, lineHeight: headingSize * 1.5 }]}>{heading}</Text>
    </View>
    <Text style={styles.body}>{description}</Text>
    {detail && <Text style={styles.body}>{detail}</Text>}
    {action && <Action {...action} />}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: tokens.color.surface, padding: tokens.space.card, gap: tokens.space.item, borderRadius: tokens.radius, borderLeftWidth: 3 },
  headingRow: { flexDirection: 'row', gap: tokens.space.small, alignItems: 'flex-start' },
  heading: { color: tokens.color.text, fontWeight: '600', flexShrink: 1 },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
