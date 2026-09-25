import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { isPreviewInput, type Activity, type LocalTimeInput, type PreviewInput } from '../api/oathSchema';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import { SnapshotRules } from './SnapshotRules';
import type { OathController } from './controller';
import { WallTimePicker, type TimeDraft } from './WallTimePicker';
export type OathCreationDraft = { activity: Activity; scheduled: boolean; activation: TimeDraft; deadline: TimeDraft };
function emptyDraft(timezone: string): OathCreationDraft {
  return { activity: 'running', scheduled: false, activation: { date: '', time: '', zone: timezone }, deadline: { date: '', time: '', zone: timezone } };
}
export function OathScreen({ controller, timezone, onLogout, onBack, initialDraft, onDraftChange }: { controller: OathController; timezone: string; onLogout(): void; onBack?(): void; initialDraft?: OathCreationDraft | null; onDraftChange?(draft: OathCreationDraft | null): void }) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [draft, setDraft] = useState<OathCreationDraft>(() => initialDraft ?? emptyDraft(timezone));
  const { activity, scheduled, activation, deadline } = draft;
  function changeDraft(patch: Partial<OathCreationDraft>) {
    const next = { ...draft, ...patch }; setDraft(next); onDraftChange?.(next);
  }
  const setActivity = (activity: Activity) => changeDraft({ activity });
  const setScheduled = (scheduled: boolean) => changeDraft({ scheduled });
  const setActivation = (activation: TimeDraft) => changeDraft({ activation });
  const setDeadline = (deadline: TimeDraft) => changeDraft({ deadline });
  const [mode, setMode] = useState<'form' | 'review' | 'detail'>('form');
  const [submitted, setSubmitted] = useState(false);
  const ready = state.kind === 'ready' ? state : undefined;
  const busy = ready?.busy ?? true;
  const pending = ready?.pending;
  const oath = ready?.oath;
  useEffect(() => { if (oath) { setMode('detail'); onDraftChange?.(null); } }, [oath, onDraftChange]);
  const local = (draft: TimeDraft): LocalTimeInput => ({ local: `${draft.date}T${draft.time}`, timezone: draft.zone, ...(draft.offset ? { offset: draft.offset } : {}) });
  const input: PreviewInput = { activity, activation: scheduled ? { mode: 'scheduled', time: local(activation) } : { mode: 'now' }, deadline: local(deadline) };
  const valid = isPreviewInput(input);
  const error = ready?.error;
  const choices = submitted && error?.kind === 'time_error' && error.code === 'ambiguous_local_time' ? error : undefined;
  const detail = oath && mode === 'detail';
  const review = !detail && ready?.preview && (mode === 'review' || !!pending);
  async function preview() {
    if (!valid || busy || pending) return;
    setSubmitted(true); await controller.preview(input);
    const next = controller.getState();
    if (next.kind === 'ready' && next.preview) setMode('review');
  }
  function timeFields(field: 'activation' | 'deadline', draft: TimeDraft, setDraft: (value: TimeDraft) => void) {
    const occurrence = choices?.field === field ? choices : undefined;
    return <View style={styles.group}>
      <WallTimePicker field={field} value={draft} disabled={busy} onChange={value => { if (!busy) { setDraft(value); setSubmitted(false); } }} />
      {occurrence && <View style={styles.group}>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oath.offsetChoice', { field: t(`oath.${field}Time`) })}</Text>
        {occurrence.validOffsets?.map(offset => <Pressable key={offset} accessibilityRole="radio"
          accessibilityLabel={t('oath.occurrence', { offset })} accessibilityState={{ selected: draft.offset === offset, disabled: busy }} disabled={busy}
          style={[styles.choice, draft.offset === offset && styles.selected]} onPress={() => { if (!busy) setDraft({ ...draft, offset }); }}>
          <Text style={styles.body}>{t('oath.occurrence', { offset })}</Text>
        </Pressable>)}
      </View>}
    </View>;
  }
  let errorText: string | undefined;
  if (error) {
    if (error.kind === 'storage') errorText = t('oath.storageError');
    else if (error.kind === 'time_error' || error.kind === 'oath_error') errorText = t(`oath.error.${error.code}`, { defaultValue: t('oath.error.generic') });
    else errorText = t(error.kind === 'invalid_request' ? 'oath.error.invalid_request' : 'oath.error.generic');
  }
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {onBack && <Action label={t('oathHome.today')} variant="secondary" onPress={onBack} />}
      {!review && !detail && <Text accessibilityRole="header" style={styles.title}>{t('oath.title')}</Text>}
      {!ready && <>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{t(state.kind === 'storage_unavailable' ? 'oath.storageError' : 'oath.loading')}</Text>
        {state.kind === 'storage_unavailable' && <Action label={t('oath.retry')} onPress={() => { void controller.refresh(); }} />}
      </>}
      {ready && errorText && <Text accessibilityLiveRegion="polite" style={styles.body}>{errorText}</Text>}
      {ready?.needsReview && <Text style={styles.body}>{t('oath.reviewAgain')}</Text>}
      {pending && <>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oath.pending')}</Text>
        <Action label={t('oath.recover')} busy={busy} onPress={() => { void controller.recover(); }} />
      </>}
      {detail && <>
        <Text accessibilityRole="header" style={styles.title}>{t('oath.confirmed')}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oath.state', { state: t(`oath.states.${oath.state}`) })}</Text>
        <SnapshotRules snapshot={oath.snapshot} />
        {!pending && <Action label={t('oath.newOath')} variant="secondary" onPress={() => { if (controller.resetCreation()) { const next = emptyDraft(timezone); setDraft(next); onDraftChange?.(null); setMode('form'); setSubmitted(false); } }} />}
      </>}
      {review && <>
        <Text style={styles.body}>{t('oath.reviewIntro')}</Text>
        <SnapshotRules snapshot={ready.preview!.snapshot} />
        {!pending && <>
          <Text style={styles.body}>{t('oath.consent')}</Text>
          <Action label={t('oath.confirm')} busy={busy} onPress={() => { void controller.confirm(); }} />
          <Action label={t('oath.edit')} busy={busy} variant="secondary" onPress={() => { setMode('form'); setSubmitted(false); }} />
        </>}
      </>}
      {ready && !pending && !review && !detail && <>
        <Text style={styles.body}>{t('oath.intro')}</Text>
        <Text style={styles.label}>{t('oath.activity')}</Text>
        {(['running', 'strength_training', 'mobility'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={t(`oath.activities.${value}`)}
          accessibilityState={{ selected: activity === value, disabled: busy }} disabled={busy} style={[styles.choice, activity === value && styles.selected]}
          onPress={() => { if (!busy) setActivity(value); }}><Text style={styles.body}>{t(`oath.activities.${value}`)}</Text></Pressable>)}
        <Text style={styles.label}>{t('oath.startChoice')}</Text>
        {[false, true].map(value => <Pressable key={String(value)} accessibilityRole="radio" accessibilityLabel={t(value ? 'oath.scheduled' : 'oath.now')}
          accessibilityState={{ selected: scheduled === value, disabled: busy }} disabled={busy} style={[styles.choice, scheduled === value && styles.selected]}
          onPress={() => { if (!busy) { setScheduled(value); setSubmitted(false); } }}><Text style={styles.body}>{t(value ? 'oath.scheduled' : 'oath.now')}</Text></Pressable>)}
        {scheduled && timeFields('activation', activation, setActivation)}
        {timeFields('deadline', deadline, setDeadline)}
        <Action label={t('oath.viewRules')} busy={busy} onPress={() => { void preview(); }}
          {...(!valid || (!!choices && !(choices.field === 'activation' ? activation.offset : deadline.offset))
            ? { disabled: true, unavailableReason: !valid ? t('oath.formRequired') : t('oath.error.ambiguous_local_time') } : { disabled: false })} />
      </>}
      <Action label={t('auth.signOut')} variant="secondary" onPress={onLogout} />
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas },
  content: { flexGrow: 1, padding: tokens.space.card, gap: tokens.space.section },
  group: { gap: tokens.space.item }, field: { gap: tokens.space.small },
  title: { color: tokens.color.text, fontSize: tokens.title, lineHeight: tokens.title * 1.2, fontWeight: '600' },
  label: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  choice: { minHeight: 64, padding: 18, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius },
  selected: { backgroundColor: '#493821', borderColor: tokens.color.primary },
  input: { minHeight: tokens.controlHeight, padding: tokens.space.item, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius, color: tokens.color.text, fontSize: tokens.body },
});
