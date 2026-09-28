import { useState } from 'react';
import { FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
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
  const locale = i18n.resolvedLanguage ?? 'en';
  const label = (part: string) => t(`oath.${field}${part[0].toUpperCase()}${part.slice(1)}`);
  const zoneName = (zone: string) => zoneLabel(zone, t);
  const dateName = (date: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(calendarDate(date));
  const current = wallNow(value.zone, now());
  const isToday = value.date === current.date;
  const [nowHour, nowMinute] = current.time.split(':');
  const past = `${hour}:${minute}` <= current.time && isToday;
  function show(part: 'date' | 'time' | 'zone') {
    if (disabled) return;
    if (part === 'date') setMonth((value.date && value.date >= current.date ? value.date : current.date).slice(0, 7));
    if (part === 'time') { setHour(value.time.slice(0, 2) || '18'); setMinute(value.time.slice(3, 5) || '00'); }
    setQuery(''); setOpen(part);
  }
  function change(part: 'date' | 'time' | 'zone', next: string) { onChange({ ...value, [part]: next, offset: undefined }); setOpen(null); }
  const first = month ? calendarDate(`${month}-01`) : null;
  const days = first ? new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate() : 0;
  const blank = first ? (first.getUTCDay() + 6) % 7 : 0;
  function moveMonth(delta: number) { if (first) { first.setUTCMonth(first.getUTCMonth() + delta); setMonth(first.toISOString().slice(0, 7)); } }
  const zones = open === 'zone' ? availableZones(value.zone).filter(zone => `${zoneName(zone)} ${zone}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))) : [];
  return <View style={styles.group}>
    {(['date', 'time', 'zone'] as const).map(part => <Pressable key={part} accessibilityRole="button" accessibilityLabel={label(part)} accessibilityValue={{ text: part === 'date' ? value.date ? dateName(value.date) : t('timePicker.chooseDate') : part === 'time' ? value.time.slice(0, 5) || t('timePicker.chooseTime') : `${zoneName(value.zone)} · ${value.zone}` }} accessibilityState={{ disabled }} disabled={disabled} onPress={() => show(part)} style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
      <Text style={styles.caption}>{label(part)}</Text>
      <Text style={styles.value}>{part === 'date' ? value.date ? dateName(value.date) : t('timePicker.chooseDate') : part === 'time' ? value.time.slice(0, 5) || t('timePicker.chooseTime') : zoneName(value.zone)}</Text>
      {part === 'zone' && <Text style={styles.caption}>{value.zone}</Text>}
    </Pressable>)}
    <Text style={styles.caption}>{t('timePicker.seconds')}</Text>
    <Modal visible={open !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
      <SafeAreaView style={styles.modal} accessibilityViewIsModal>
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{open ? label(open) : ''}</Text><Action label={t('timePicker.close')} variant="secondary" onPress={() => setOpen(null)} /></View>
        {open === 'date' && first && <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>{new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(first)}</Text>
          <View style={styles.row}><View style={styles.flex}>{month <= current.date.slice(0, 7) ? <Action label={t('timePicker.previousMonth')} variant="secondary" disabled unavailableReason={t('timePicker.pastMonth')} onPress={() => {}} /> : <Action label={t('timePicker.previousMonth')} variant="secondary" onPress={() => moveMonth(-1)} />}</View><View style={styles.flex}><Action label={t('timePicker.nextMonth')} variant="secondary" onPress={() => moveMonth(1)} /></View></View>
          <View style={styles.grid}>{Array.from({ length: largeText ? 0 : blank }, (_, i) => <View key={`blank-${i}`} style={styles.day} />)}{Array.from({ length: days }, (_, i) => {
            const date = `${month}-${pad(i + 1)}`;
            const gone = date < current.date; const marked = date === current.date;
            return <Pressable key={date} accessibilityRole="button" accessibilityLabel={marked ? `${dateName(date)}, ${t('timePicker.today')}` : dateName(date)} accessibilityState={{ selected: value.date === date, disabled: gone }} disabled={gone} onPress={() => change('date', date)} style={[largeText ? styles.wideDay : styles.day, styles.cell, marked && styles.today, value.date === date && styles.selected, gone && styles.gone]}><Text style={[styles.value, gone && styles.goneText]}>{largeText ? dateName(date) : i + 1}</Text></Pressable>;
          })}</View>
        </ScrollView>}
        {open === 'time' && <><ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.clock}>{hour}:{minute}</Text>
          {(['hour', 'minute'] as const).map(part => <View key={part} style={styles.group}><Text accessibilityRole="header" style={styles.value}>{t(`timePicker.${part}`)}</Text><View style={styles.grid}>{Array.from({ length: part === 'hour' ? 24 : 60 }, (_, i) => {
            const number = pad(i); const selected = number === (part === 'hour' ? hour : minute);
            const gone = isToday && (part === 'hour' ? number < nowHour : hour < nowHour || (hour === nowHour && number <= nowMinute));
            return <Pressable key={number} accessibilityRole="radio" accessibilityLabel={`${t(`timePicker.${part}`)} ${number}`} accessibilityState={{ selected, disabled: gone }} disabled={gone} onPress={() => part === 'hour' ? setHour(number) : setMinute(number)} style={[styles.number, styles.cell, selected && styles.selected, gone && styles.gone]}><Text style={[styles.value, gone && styles.goneText]}>{number}</Text></Pressable>;
          })}</View></View>)}
        </ScrollView><View style={styles.footer}>{past ? <Action label={t('timePicker.done')} disabled unavailableReason={t('timePicker.pastTime')} onPress={() => {}} /> : <Action label={t('timePicker.done')} onPress={() => change('time', `${hour}:${minute}:00`)} />}</View></>}
        {open === 'zone' && <View style={styles.flex}><View style={styles.content}><Text style={styles.caption}>{t('timePicker.zoneHelp')}</Text><TextInput accessibilityLabel={t('timePicker.searchZone')} placeholder={t('timePicker.searchZone')} placeholderTextColor={tokens.color.secondary} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} style={styles.search} /></View><FlatList keyboardShouldPersistTaps="handled" data={zones} keyExtractor={zone => zone} contentContainerStyle={styles.content} ListEmptyComponent={<Text style={styles.value}>{t('timePicker.noZones')}</Text>} renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityLabel={`${zoneName(item)} · ${item}`} accessibilityState={{ selected: value.zone === item }} onPress={() => change('zone', item)} style={[styles.field, item === value.zone && styles.selected]}><Text style={styles.value}>{zoneName(item)}</Text><Text style={styles.caption}>{item}</Text></Pressable>} /></View>}
      </SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 12 }, field: { padding: 16, gap: 4, minHeight: 64, backgroundColor: tokens.color.surface, borderRadius: 20, borderBottomWidth: 3, borderBottomColor: '#101416' },
  caption: { color: tokens.color.secondary, fontSize: 14, lineHeight: 21 }, value: { color: tokens.color.text, fontSize: 17, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: tokens.color.canvas }, header: { padding: 16, gap: 12 }, title: { color: tokens.color.text, fontSize: 24, fontWeight: '700' },
  content: { padding: 16, gap: 16 }, row: { flexDirection: 'row', gap: 12 }, flex: { flex: 1 }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wideDay: { width: '100%', minHeight: 52 },
  day: { width: '14.2857%', minHeight: 52 }, number: { minWidth: 52, minHeight: 52, flexGrow: 1, margin: 3 }, cell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 }, selected: { backgroundColor: '#493821', borderColor: tokens.color.primary },
  today: { borderWidth: 2, borderColor: '#b58a52' }, gone: { opacity: 0.35 }, goneText: { color: tokens.color.secondary },
  pressed: { opacity: 0.75 }, clock: { color: tokens.color.primary, fontSize: 36, fontWeight: '700' }, footer: { padding: 16 }, search: { color: tokens.color.text, backgroundColor: tokens.color.surface, borderRadius: 18, padding: 14, fontSize: 17, minHeight: 48 },
});
