import { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { isPreviewInput, type Activity, type LocalTimeInput, type PreviewInput } from '../api/oathSchema';
import { Action } from '../ui/Action';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import { CommitMark } from '../ui/CommitMark';
import { GameChoice } from '../ui/GameChoice';
import { tokens } from '../ui/tokens';
import { SceneSurface } from '../ui/SceneSurface';
import { CompanionBubble } from '../ui/CompanionBubble';
import { SceneDoor } from '../ui/SceneDoor';
import { ActivityOffering } from './ActivityOffering';
import { SnapshotRules } from './SnapshotRules';
import type { OathController } from './controller';
import { WallTimePicker, type TimeDraft } from './WallTimePicker';
export type OathCreationDraft = { activity: Activity; scheduled: boolean; activation: TimeDraft; deadline: TimeDraft };
function emptyDraft(timezone: string): OathCreationDraft {
  return { activity: 'running', scheduled: false, activation: { date: '', time: '', zone: timezone }, deadline: { date: '', time: '', zone: timezone } };
}
export function OathScreen({ controller, timezone, onLogout, onBack, backLabel, initialDraft, onDraftChange }: { controller: OathController; timezone: string; onLogout(): void; onBack?(): void; backLabel?: string; initialDraft?: OathCreationDraft | null; onDraftChange?(draft: OathCreationDraft | null): void }) {
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
  const scene = `${detail ? 'detail' : pending ? 'pending' : review ? 'review' : 'form'}-${error?.kind ?? ''}-${error && 'code' in error ? error.code : ''}`;
  const entrance = useSceneEntrance(scene);
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
  return <SceneSurface tone="hearth"><SafeAreaView style={styles.safeArea}>
    <Animated.ScrollView style={entrance} key={scene} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {onBack && <SceneDoor label={backLabel ?? t('oathHome.today')} onPress={onBack} />}
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
        <View style={styles.confirmed}>
          <CommitMark />
          <Text accessibilityRole="header" style={styles.title}>{t('oath.confirmed')}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oath.state', { state: t(`oath.states.${oath.state}`) })}</Text>
        </View>
        <SnapshotRules snapshot={oath.snapshot} />
        {!pending && <Action label={t('oath.newOath')} variant="secondary" onPress={() => { if (controller.resetCreation()) { const next = emptyDraft(timezone); setDraft(next); onDraftChange?.(null); setMode('form'); setSubmitted(false); } }} />}
      </>}
      {review && <>
        <CompanionBubble message={t('oath.reviewIntro')} />
        <SnapshotRules snapshot={ready.preview!.snapshot} />
        {!pending && <>
          <View style={styles.consent}><Text style={styles.body}>{t('oath.consent')}</Text></View>
          <Action label={t('oath.confirm')} busy={busy} onPress={() => { void controller.confirm(); }} />
          <Action label={t('oath.edit')} busy={busy} variant="secondary" onPress={() => { setMode('form'); setSubmitted(false); }} />
        </>}
      </>}
      {ready && !pending && !review && !detail && <>
        <CompanionBubble message={t('oath.intro')} />
        <View style={styles.workbench}>
          <Text accessibilityRole="header" style={styles.label}>{t('oath.activity')}</Text>
          <View style={styles.offerings}>
            {(['running', 'strength_training', 'mobility'] as const).map(value => <ActivityOffering key={value} activity={value}
              label={t(`oath.activities.${value}`)} selected={activity === value} disabled={busy} onPress={() => setActivity(value)} />)}
          </View>
        </View>
        <View style={styles.timeWorkbench}>
          <Text accessibilityRole="header" style={styles.label}>{t('oath.startChoice')}</Text>
          {[false, true].map(value => <GameChoice key={String(value)} label={t(value ? 'oath.scheduled' : 'oath.now')} symbol={value ? '◷' : 'ϟ'}
            selected={scheduled === value} disabled={busy} onPress={() => { setScheduled(value); setSubmitted(false); }} />)}
          {scheduled && timeFields('activation', activation, setActivation)}
          {timeFields('deadline', deadline, setDeadline)}
        </View>
        <Action label={t('oath.viewRules')} busy={busy} onPress={() => { void preview(); }}
          {...(!valid || (!!choices && !(choices.field === 'activation' ? activation.offset : deadline.offset))
            ? { disabled: true, unavailableReason: !valid ? t('oath.formRequired') : t('oath.error.ambiguous_local_time') } : { disabled: false })} />
      </>}
      <Action label={t('auth.signOut')} variant="secondary" onPress={onLogout} />
    </Animated.ScrollView>
  </SafeAreaView></SceneSurface>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: tokens.space.card, paddingBottom: 36, gap: tokens.space.section },
  workbench: { gap: 14 }, offerings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' },
  timeWorkbench: { padding: 18, gap: 18, backgroundColor: 'rgba(28, 24, 20, 0.92)', borderRadius: 24 },
  confirmed: { gap: 14, alignItems: 'center', paddingVertical: 24 },
  consent: { padding: 20, borderLeftWidth: 3, borderLeftColor: tokens.color.primary, backgroundColor: 'rgba(32, 25, 19, 0.94)', borderRadius: 12 },
  group: { gap: tokens.space.item },
  title: { color: tokens.color.text, fontFamily: tokens.font.display, fontSize: tokens.title, lineHeight: tokens.title * 1.3, fontWeight: '400' },
  label: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  choice: { minHeight: 64, padding: 18, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius },
  selected: { backgroundColor: '#493821', borderColor: tokens.color.primary },
});
