import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import { FadeStrips } from '../ui/FadeStrips';
import timezoneIdentifiers from './timezoneIdentifiers.json';
import { zoneLabel } from './zoneLabel';

export type TimeDraft = { date: string; time: string; zone: string; offset?: string };
const pad = (n: number) => String(n).padStart(2, '0');
// UTC is used only as a Gregorian calendar container, never to resolve the player's wall time.
function calendarDate(date: string) { return new Date(`${date}T12:00:00Z`); }
// Today's wall date and minute in the chosen zone, from server-corrected now. A convenience only, the server rejects past times.
function wallNow(zone: string, instant: number) {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
    const get = (type: string) => parts.find(p => p.type === type)!.value;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
  } catch {
    // An unknown zone falls back to UTC for these limits only; keep the selected zone
    // and unmodified wall-time input for authoritative server resolution.
    const iso = new Date(instant).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
}

function availableZones(current: string) {
  const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  return [...new Set([current, 'UTC', 'Europe/Warsaw', 'Europe/London', ...(supported?.('timeZone') ?? timezoneIdentifiers)])];
}
export function WallTimePicker({ field, value, disabled, now, onChange }: { field: 'activation' | 'deadline'; value: TimeDraft; disabled: boolean; now(): number; onChange(value: TimeDraft): void }) {
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const [open, setOpen] = useState<'date' | 'time' | 'zone' | null>(null);
  const [month, setMonth] = useState('');
  const [hour, setHour] = useState('18');
  const [minute, setMinute] = useState('00');
  const [query, setQuery] = useState('');
  // The time sheet's scroll: how tall it is, how tall its content and how far it moved, so a fade can show that more minutes follow.
  // Only the flag is state, so a scroll re-renders the sheet just when the fade appears or goes.
  const minutes = useRef({ height: 0, content: 0, offset: 0 });
  const [moreMinutes, setMoreMinutes] = useState(false);
  function measureMinutes(patch: Partial<typeof minutes.current>) {
    const next = { ...minutes.current, ...patch }; minutes.current = next;
    const more = next.content > next.height + 1 && next.offset + next.height < next.content - 1;
    if (more !== moreMinutes) setMoreMinutes(more);
  }
  // Review, 2026-09-30: an idle form rendered at 22:50 opened at 22:56 on a greyed 22:51. The sheets use the time of opening.
  const [openedAt, setOpenedAt] = useState(now);
  const locale = i18n.resolvedLanguage ?? 'en';
  const label = (part: string) => t(`oath.${field}${part[0].toUpperCase()}${part.slice(1)}`);
  const zoneName = (zone: string) => zoneLabel(zone, t);
  const dateName = (date: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(calendarDate(date));
  const current = wallNow(value.zone, openedAt);
  const isToday = value.date === current.date;
  const [nowHour, nowMinute] = current.time.split(':');
  const past = `${hour}:${minute}` <= current.time && isToday;
  function show(part: 'date' | 'time' | 'zone') {
    if (disabled) return;
    const at = now(); const opened = wallNow(value.zone, at);
    setOpenedAt(at);
    if (part === 'date') setMonth((value.date && value.date >= opened.date ? value.date : opened.date).slice(0, 7));
    if (part === 'time') {
      // Native check, 2026-09-30 at 22:54: today opened on a greyed 18:00. A time that already passed moves to the first minute after now, while 23:59 has none left.
      const held = [value.time.slice(0, 2) || '18', value.time.slice(3, 5) || '00'];
      const [openHour, openMinute] = opened.time.split(':');
      const after = Number(openHour) * 60 + Number(openMinute) + 1;
      const [h, m] = value.date === opened.date && `${held[0]}:${held[1]}` <= opened.time && after < 24 * 60 ? [pad(Math.floor(after / 60)), pad(after % 60)] : held;
      setHour(h); setMinute(m);
      // A new sheet starts at its top and measures itself again.
      minutes.current = { height: 0, content: 0, offset: 0 }; setMoreMinutes(false);
    }
    setQuery(''); setOpen(part);
  }
  function change(part: 'date' | 'time' | 'zone', next: string) { onChange({ ...value, [part]: next, offset: undefined }); setOpen(null); }
  const first = month ? calendarDate(`${month}-01`) : null;
  const days = first ? new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate() : 0;
  const blank = first ? (first.getUTCDay() + 6) % 7 : 0;
  function moveMonth(delta: number) { if (first) { first.setUTCMonth(first.getUTCMonth() + delta); setMonth(first.toISOString().slice(0, 7)); } }
  const zones = open === 'zone' ? availableZones(value.zone).filter(zone => `${zoneName(zone)} ${zone}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))) : [];
  // Native check, 2026-09-30: at the largest text size (fontScale 3.571, value 60.7 pt) "października" needs about 437 pt and broke mid-word.
  // Capped at 2.5 (42.5 pt) it needs about 306 pt. Narrower side padding leaves 334 pt on a 402 pt screen and 307 pt on 375 pt.
  // The 14 pt label and zone identifier share the cap (35 pt at most), so they stay below the value.
  // Native check, 2026-09-30: at fontScale 3.571 the sheet titles broke as "ukończe" / "nia" ("ukończenia" needs 445 pt at 85.7 pt).
  // Titles, the month heading and the clock take the display cap (253 pt, "październik" 256 pt, "23:59" about 198 pt).
  // MVP-22-B2 (G18): the month buttons are ‹ and › icons with their names for VoiceOver, and the past month reason is the disabled button's hint.
  // The full-width day rows keep the date sheet's 8 pt side padding at large text.
  // Zone rows take the choice cap and the narrower padding ("DumontDUrville" 430 pt uncapped, 304 pt capped, 327 pt row at 375).
  const title = (text: string) => <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{text}</Text>;
  const icon = (glyph: string, name: string, onPress: () => void, unavailable?: string) => <Pressable accessibilityRole="button" accessibilityLabel={name}
    accessibilityHint={unavailable} accessibilityState={{ disabled: !!unavailable }} disabled={!!unavailable} onPress={onPress}
    style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
    <Text accessible={false} allowFontScaling={false} style={[styles.glyph, !!unavailable && styles.goneGlyph]}>{glyph}</Text>
  </Pressable>;
  // Monday first like the grid. 1 January 2024 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  return <View style={styles.group}>
    {(['date', 'time', 'zone'] as const).map(part => <Pressable key={part} accessibilityRole="button" accessibilityLabel={label(part)} accessibilityValue={{ text: part === 'date' ? value.date ? dateName(value.date) : t('timePicker.chooseDate') : part === 'time' ? value.time.slice(0, 5) || t('timePicker.chooseTime') : `${zoneName(value.zone)} · ${value.zone}` }} accessibilityState={{ disabled }} disabled={disabled} onPress={() => show(part)} style={({ pressed }) => [styles.field, largeText && styles.wideField, pressed && styles.pressed]}>
      <Text maxFontSizeMultiplier={tokens.maxScale.choice} style={styles.caption}>{label(part)}</Text>
      <Text maxFontSizeMultiplier={tokens.maxScale.choice} style={styles.value}>{part === 'date' ? value.date ? dateName(value.date) : t('timePicker.chooseDate') : part === 'time' ? value.time.slice(0, 5) || t('timePicker.chooseTime') : zoneName(value.zone)}</Text>
      {part === 'zone' && <Text maxFontSizeMultiplier={tokens.maxScale.choice} style={styles.caption}>{value.zone}</Text>}
    </Pressable>)}
    <Modal visible={open !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
      <SafeAreaView style={styles.modal} accessibilityViewIsModal>
        <View testID="sheet-header" style={styles.header}><View style={styles.flex}>{title(open ? label(open) : '')}</View>{icon('×', t('timePicker.close'), () => setOpen(null))}</View>
        {open === 'date' && first && <ScrollView testID="date-sheet" contentContainerStyle={[styles.content, largeText && styles.wideContent]}>
          <View testID="month-nav" style={styles.row}>
            {icon('‹', t('timePicker.previousMonth'), () => moveMonth(-1), month <= current.date.slice(0, 7) ? t('timePicker.pastMonth') : undefined)}
            <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={[styles.title, styles.month]}>{new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(first)}</Text>
            {icon('›', t('timePicker.nextMonth'), () => moveMonth(1))}
          </View>
          {!largeText && <View testID="weekday-header" style={styles.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{weekdays.map(name => <Text key={name} numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.day, styles.weekday]}>{name}</Text>)}</View>}
          <View style={styles.grid}>{Array.from({ length: largeText ? 0 : blank }, (_, i) => <View key={`blank-${i}`} style={styles.day} />)}{Array.from({ length: days }, (_, i) => {
            const date = `${month}-${pad(i + 1)}`;
            const gone = date < current.date; const marked = date === current.date;
            return <Pressable key={date} accessibilityRole="button" accessibilityLabel={marked ? `${dateName(date)}, ${t('timePicker.today')}` : dateName(date)} accessibilityState={{ selected: value.date === date, disabled: gone }} disabled={gone} onPress={() => change('date', date)} style={[largeText ? styles.wideDay : styles.day, styles.cell, marked && styles.today, value.date === date && styles.selected, gone && styles.gone]}><Text maxFontSizeMultiplier={tokens.maxScale.choice} style={[styles.value, gone && styles.goneText]}>{largeText ? dateName(date) : i + 1}</Text></Pressable>;
          })}</View>
        </ScrollView>}
        {open === 'time' && <><View style={styles.flex}><ScrollView testID="time-sheet" contentContainerStyle={styles.content} scrollEventThrottle={32}
          onLayout={({ nativeEvent: { layout } }) => measureMinutes({ height: layout.height })}
          onContentSizeChange={(_, height) => measureMinutes({ content: height })}
          onScroll={({ nativeEvent }) => measureMinutes({ height: nativeEvent.layoutMeasurement.height, content: nativeEvent.contentSize.height, offset: nativeEvent.contentOffset.y })}>
          <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.clock}>{hour}:{minute}</Text>
          {(['hour', 'minute'] as const).map(part => <View key={part} style={styles.group}><Text accessibilityRole="header" style={styles.value}>{t(`timePicker.${part}`)}</Text><View style={styles.grid}>{Array.from({ length: part === 'hour' ? 24 : 60 }, (_, i) => {
            const number = pad(i); const selected = number === (part === 'hour' ? hour : minute);
            const gone = isToday && (part === 'hour' ? number < nowHour : hour < nowHour || (hour === nowHour && number <= nowMinute));
            return <Pressable key={number} accessibilityRole="radio" accessibilityLabel={`${t(`timePicker.${part}`)} ${number}`} accessibilityState={{ selected, disabled: gone }} disabled={gone} onPress={() => part === 'hour' ? setHour(number) : setMinute(number)} style={[styles.number, styles.cell, selected && styles.selected, gone && styles.gone]}><Text style={[styles.value, gone && styles.goneText]}>{number}</Text></Pressable>;
          })}</View></View>)}
        </ScrollView>
        {/* MVP-22-B2 (G19): the minutes run past the sheet's edge, so a fade above the footer shows that more follow until the end. */}
        {moreMinutes && <FadeStrips testID="time-sheet-fade" stripTestID="time-sheet-fade-strip" from="bottom" style={styles.minuteFade} />}
        </View><View style={styles.footer}>
          {/* MVP-22-A6: the minute note belongs to choosing a time, so it sits only in this sheet's footer. */}
          <Text style={styles.caption}>{t('timePicker.seconds')}</Text>
          {past ? <Action label={t('timePicker.done')} disabled unavailableReason={t('timePicker.pastTime')} onPress={() => {}} /> : <Action label={t('timePicker.done')} onPress={() => change('time', `${hour}:${minute}:00`)} />}</View></>}
        {open === 'zone' && <View style={styles.flex}><View style={styles.content}><Text style={styles.caption}>{t('timePicker.zoneHelp')}</Text><TextInput accessibilityLabel={t('timePicker.searchZone')} placeholder={t('timePicker.searchZone')} placeholderTextColor={tokens.color.secondary} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} style={styles.search} /></View><FlatList keyboardShouldPersistTaps="handled" data={zones} keyExtractor={zone => zone} contentContainerStyle={styles.content} ListEmptyComponent={<Text style={styles.value}>{t('timePicker.noZones')}</Text>} renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityLabel={`${zoneName(item)} · ${item}`} accessibilityState={{ selected: value.zone === item }} onPress={() => change('zone', item)} style={[styles.field, largeText && styles.wideField, item === value.zone && styles.selected]}><Text maxFontSizeMultiplier={tokens.maxScale.choice} style={styles.value}>{zoneName(item)}</Text><Text maxFontSizeMultiplier={tokens.maxScale.choice} style={styles.caption}>{item}</Text></Pressable>} /></View>}
      </SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 12 }, field: { padding: 16, gap: 4, minHeight: 64, backgroundColor: tokens.color.surface, borderRadius: 20, borderBottomWidth: 3, borderBottomColor: tokens.warm.edge }, wideField: { paddingHorizontal: tokens.space.small },
  caption: { color: tokens.color.secondary, fontSize: 14, lineHeight: 21 }, value: { color: tokens.color.text, fontSize: 17, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: tokens.color.canvas }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 16, paddingRight: 8 }, title: { color: tokens.color.text, fontSize: 24, fontWeight: '700' },
  month: { flex: 1, flexShrink: 1, textAlign: 'center' },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, glyph: { color: tokens.color.primary, fontSize: 30, lineHeight: 36 }, goneGlyph: { color: tokens.color.secondary, opacity: 0.35 },
  minuteFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 32 },
  content: { padding: 16, gap: 16 }, wideContent: { paddingHorizontal: tokens.space.small }, row: { flexDirection: 'row', alignItems: 'center', gap: 4 }, flex: { flex: 1 }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wideDay: { width: '100%', minHeight: 52 },
  day: { width: '14.2857%', minHeight: 52 }, weekday: { minHeight: 0, color: tokens.color.secondary, fontSize: 13, lineHeight: 18, textAlign: 'center' }, number: { minWidth: 52, minHeight: 52, flexGrow: 1, margin: 3 }, cell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 }, selected: { backgroundColor: '#493821', borderColor: tokens.color.primary },
  today: { borderWidth: 2, borderColor: '#b58a52' }, gone: { opacity: 0.35 }, goneText: { color: tokens.color.secondary },
  pressed: { opacity: 0.75 }, clock: { color: tokens.color.primary, fontSize: 36, fontWeight: '700' }, footer: { padding: 16, gap: 12 }, search: { color: tokens.color.text, backgroundColor: tokens.color.surface, borderRadius: 18, padding: 14, fontSize: 17, minHeight: 48 },
});
