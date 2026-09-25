import { StyleSheet, Text, View } from 'react-native';
import type { ResolvedTime, Snapshot } from '../api/oathSchema';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale, type Locale } from '../localization/locale';
import { tokens } from '../ui/tokens';

const sections = ['activation', 'timing', 'evidence', 'photo', 'activityRecord', 'privacy', 'rewards', 'consequence', 'pause', 'recovery', 'review', 'appeal'] as const;
const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };

export function storedTime(value: ResolvedTime, locale: Locale): string {
  // Format the stored wall time without asking a device timezone database to reinterpret it.
  const display = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${value.local}Z`));
  return `${display} · ${value.timezone} · UTC${value.offset}`;
}
function cutoffTime(snapshot: Snapshot, locale: Locale): string {
  const instant = new Date(snapshot.deadline.receiptCutoff);
  const timezone = snapshot.deadline.timezone;
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', calendar: 'gregory', numberingSystem: 'latn' }).formatToParts(instant);
    const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === name)?.value;
    const wall = `${part('year')!.padStart(4, '0')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
    const minutes = (Date.parse(`${wall}Z`) - instant.getTime()) / 60000;
    if (!Number.isInteger(minutes)) throw new Error('Unrepresentable offset');
    const offset = `${minutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
    return storedTime({ local: wall, timezone, offset, explicitOffset: false, utc: snapshot.deadline.receiptCutoff }, locale);
  } catch {
    // Unsupported device timezone data must not hide or shift the authoritative cutoff.
    return `${new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(instant)} · UTC+00:00`;
  }
}

export function SnapshotRules({ snapshot }: { snapshot: Snapshot }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const copy = snapshot.copy[locale];
  const deadline = storedTime(snapshot.deadline, locale);
  const activation = snapshot.activation.time ? storedTime(snapshot.activation.time, locale) : t('oath.rules.now');
  const promise = copy.promise.replace('{activity}', copy.activity).replace('{deadline}', deadline);
  const facts = [
    [t('oath.rules.activity'), copy.activity], [t('oath.rules.activation'), activation],
    [t('oath.rules.deadline'), deadline], [t('oath.rules.cutoff'), cutoffTime(snapshot, locale)],
  ];
  return <View style={styles.rules}>
    <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
    <Text style={styles.secondary}>{copy.subtitle}</Text>
    <Text style={styles.body}>{promise}</Text>
    {facts.map(([label, value]) => <View key={label} style={styles.group}>
      <Text accessibilityRole="header" style={styles.heading}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>)}
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.heading}>{t('oath.rules.declaration')}</Text>
      <Text style={styles.body}>{copy.declaration}</Text>
    </View>
    {sections.map(section => <View key={section} style={styles.group}>
      <Text accessibilityRole="header" style={styles.heading}>{t(`oath.sections.${section}`)}</Text>
      <Text style={styles.body}>{copy.sections[section]}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  rules: { gap: tokens.space.section }, group: { gap: tokens.space.small },
  title: { color: tokens.color.text, fontSize: tokens.title, fontWeight: '700' },
  heading: { color: tokens.color.text, fontSize: tokens.body, fontWeight: '700' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: 26 },
  secondary: { color: tokens.color.secondary, fontSize: tokens.body, lineHeight: 26 },
});
