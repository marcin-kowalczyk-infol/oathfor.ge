import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import type { ResolvedTime, Snapshot } from '../api/oathSchema';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { resolveLocale, type Locale } from '../localization/locale';
import { tokens } from '../ui/tokens';
import { ActivityEmblem } from '../ui/ActivityEmblem';

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

/** The stored promise with its activity and committed deadline filled in. */
/** "+02:00" reads as "UTC+2", "+05:30" as "UTC+5:30" and "+00:00" as "UTC". The offset still tells a repeated hour apart. */
function shortOffset(offset: string): string {
  const [, sign, hours, minutes] = /^([+-])(\d{2}):(\d{2})$/.exec(offset) ?? [];
  if (!sign) return `UTC${offset}`;
  if (hours === '00' && minutes === '00') return 'UTC';
  return `UTC${sign}${Number(hours)}${minutes === '00' ? '' : `:${minutes}`}`;
}
/**
 * The promise names the deadline to the minute with a short offset (owner decision, 2026-09-29).
 * The full rules keep seconds, zone and offset from storedTime.
 */
export function promiseText(snapshot: Snapshot, locale: Locale): string {
  const copy = snapshot.copy[locale];
  const { local, offset } = snapshot.deadline;
  // Date and time are joined here, because ICU builds differ on the joining word once seconds are dropped.
  const day = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${local}Z`));
  const deadline = `${day} ${locale === 'pl' ? 'o' : 'at'} ${local.slice(11, 16)} · ${shortOffset(offset)}`;
  return copy.promise.replace('{activity}', copy.activity).replace('{deadline}', deadline);
}

export function SnapshotRules({ snapshot }: { snapshot: Snapshot }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  // Stored rule text is bound only where it is drawn. The snapshot itself never changes.
  const text = (value: string) => bindShortWords(value, locale);
  const copy = snapshot.copy[locale];
  const deadline = storedTime(snapshot.deadline, locale);
  const activation = snapshot.activation.time ? storedTime(snapshot.activation.time, locale) : t('oath.rules.now');
  const promise = promiseText(snapshot, locale);
  const facts = [
    [t('oath.rules.activity'), copy.activity], [t('oath.rules.activation'), activation],
    [t('oath.rules.deadline'), deadline], [t('oath.rules.cutoff'), cutoffTime(snapshot, locale)],
  ];
  return <View style={styles.rules}>
    <View style={styles.documentHead}>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ActivityEmblem activity={snapshot.activity} size={112} />
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{copy.title}</Text>
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.secondary}>{text(copy.subtitle)}</Text>
    </View>
    {/* Native check, 2026-09-30: uncapped at the largest size "października", "zaplanowany" and "Nierozstrzygnięta" broke mid-word
        on the parchment. Every text here takes the display cap, also the rule bodies that full-width copy elsewhere leaves uncapped. */}
    <View style={styles.promise}><Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.promiseText}>{text(promise)}</Text></View>
    <View style={styles.facts}>{facts.map(([label, value]) => <View key={label} style={styles.group}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.heading}>{label}</Text>
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{text(value)}</Text>
    </View>)}</View>
    <View style={styles.card}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.heading}>{t('oath.rules.declaration')}</Text>
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{text(copy.declaration)}</Text>
    </View>
    {sections.map(section => <View key={section} style={[styles.card, (section === 'evidence' || section === 'photo' || section === 'activityRecord') && styles.evidence]}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.heading}>{text(t(`oath.sections.${section}`))}</Text>
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{text(copy.sections[section])}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  rules: { gap: tokens.space.section, paddingHorizontal: 16, paddingVertical: 24, backgroundColor: '#e3d1ac', borderRadius: 8,
    borderTopWidth: 5, borderBottomWidth: 5, borderColor: '#a7834c', shadowColor: '#050403', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
  documentHead: { alignItems: 'center', gap: 12 }, group: { gap: tokens.space.small },
  promise: { paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#a18455' },
  promiseText: { color: '#352419', fontFamily: tokens.font.display, fontSize: 20, lineHeight: 30, fontWeight: '400' },
  facts: { padding: 16, gap: 20, backgroundColor: '#d6be92', borderRadius: 8 },
  card: { gap: 10, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#baa074' },
  evidence: { padding: 16, borderTopWidth: 0, borderLeftWidth: 3, borderLeftColor: '#906131', backgroundColor: '#dac39c', borderRadius: 4 },
  title: { color: '#352419', fontFamily: tokens.font.display, fontSize: tokens.title, fontWeight: '400', textAlign: 'center' },
  heading: { color: '#493322', fontFamily: tokens.font.display, fontSize: 19, lineHeight: 27, fontWeight: '400' },
  body: { color: '#35291f', fontSize: tokens.body, lineHeight: 26 },
  secondary: { color: '#64503c', fontSize: tokens.body, lineHeight: 26, textAlign: 'center' },
});
