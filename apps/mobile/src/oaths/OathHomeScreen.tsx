import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { formatDeadline } from '../localization/format';
import type { Oath, OathListEnvelope } from '../api/oathSchema';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import { SnapshotRules, storedTime } from './SnapshotRules';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import { ForgeHub } from './ForgeHub';
import { OathScreen, type OathCreationDraft } from './OathScreen';
import { loadPauseReview, type PauseReview } from './pauseReview';
import type { OathController } from './controller';
type ViewName = 'today' | 'history';
export function OathHomeScreen({ controller, timezone, onLogout }: { controller: OathController; timezone: string; onLogout(): void }) {
  const { t, i18n } = useTranslation(); const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { width, fontScale } = useWindowDimensions();
  const interactiveForge = width >= 350 && fontScale <= 1.3;
  const account = useSyncExternalStore(controller.subscribe, controller.getState);
  const available = account.kind === 'ready';
  const [route, setRoute] = useState<'list' | 'detail' | 'create' | 'pause'>('list');
  const [creationDraft, setCreationDraft] = useState<OathCreationDraft | null>(null);
  useEffect(() => { setCreationDraft(null); }, [controller]);
  const [view, setView] = useState<ViewName>('today');
  const entrance = useSceneEntrance(`${route}-${view}`);
  const [list, setList] = useState<OathListEnvelope | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<Oath | null>(null);
  const detailId = useRef('');
  const [pause, setPause] = useState<PauseReview | null>(null);
  const [pauseChanged, setPauseChanged] = useState(false);
  const [pauseFailed, setPauseFailed] = useState(false);
  const generation = useRef(0);
  const mutation = useRef<symbol | undefined>(undefined);
  const [mutating, setMutating] = useState(false);
  const confirmedId = available ? account.oath?.id : undefined;
  const current = (epoch: number) => epoch === generation.current;
  async function loadList(nextView: ViewName, append = false) {
    const epoch = ++generation.current;
    const previous = append ? list : null;
    const cursor = append ? list?.nextCursor : null;
    setRoute('list'); setView(nextView); setFailed(false); setLoading(true);
    if (!append) setList(null);
    const result = await controller.list({ view: nextView, ...(cursor ? { cursor } : {}) });
    if (!current(epoch)) return;
    setLoading(false);
    if (result.kind !== 'success') { setFailed(true); return; }
    // Live pagination can repeat rows after server changes; keep the returned order of new rows.
    const existing = new Set(previous?.items.map(item => item.id));
    setList({ ...result.value, items: previous ? [...previous.items, ...result.value.items.filter(item => !existing.has(item.id))] : result.value.items });
  }
  useEffect(() => {
    mutation.current = undefined; setMutating(false);
    if (available) void loadList('today');
    return () => { generation.current++; mutation.current = undefined; };
  }, [available, controller]);
  useEffect(() => {
    if (confirmedId) {
      setCreationDraft(null);
      if (route === 'list') void loadList(view);
    }
  }, [confirmedId]);
  async function openDetail(id: string) {
    const epoch = ++generation.current; detailId.current = id;
    setRoute('detail'); setDetail(null); setLoading(true); setFailed(false);
    const result = await controller.detail(id);
    if (!current(epoch)) return;
    setLoading(false);
    if (result.kind === 'success' && result.value.oath.id === id) setDetail(result.value.oath);
    else setFailed(true);
  }
  async function showPause(changed = false) {
    const epoch = ++generation.current;
    setRoute('pause'); setPause(null); setLoading(true); setFailed(false); setPauseFailed(false); setPauseChanged(changed);
    const result = await loadPauseReview(controller);
    if (!current(epoch)) return;
    setLoading(false);
    if (result.kind === 'success') setPause(result.value); else setFailed(true);
  }
  async function changePause() {
    if (!pause || mutation.current) return;
    const operation = Symbol('pause'); mutation.current = operation; setMutating(true);
    const epoch = generation.current;
    const result = await controller.pause(pause.summary.paused ? { paused: false } : { paused: true, revision: pause.summary.revision });
    if (mutation.current !== operation) return;
    mutation.current = undefined;
    setMutating(false);
    if (!current(epoch)) return;
    if (result.kind === 'success') { await loadList('today'); return; }
    if (result.kind === 'oath_error' && result.code === 'pause_preview_changed') { await showPause(true); return; }
    setPause(null); setPauseFailed(true);
  }
  function create(recover = false) {
    if (!recover && !controller.resetCreation()) return;
    generation.current++; setRoute('create');
  }
  function summary(item: Oath, actionable = false) { return t(actionable ? 'oathHome.open' : 'oathHome.summary', { activity: item.snapshot.copy[locale].activity, deadline: storedTime(item.snapshot.deadline, locale) }); }
  function category(item: Oath) { return item.state === 'scheduled' ? 'future' : item.state === 'active' ? 'current' : 'pending'; }
  function group(item: Oath) {
    const date = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.snapshot.deadline.local}Z`));
    return t('oathHome.group', { date, timezone: item.snapshot.deadline.timezone });
  }
  if (available && route === 'create') return <OathScreen controller={controller} timezone={timezone} initialDraft={creationDraft} onDraftChange={setCreationDraft} onLogout={onLogout} onBack={() => { void loadList('today'); }} />;
  return <SafeAreaView style={styles.safeArea}><Animated.ScrollView style={entrance} key={`${route}-${view}`} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{t(route === 'pause' ? 'oathHome.pauseTitle' : route === 'detail' ? 'forge.detail' : view === 'today' ? 'forge.title' : 'oathHome.history')}</Text>
    {!available && <>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{t(account.kind === 'storage_unavailable' ? 'oath.storageError' : 'oathHome.loading')}</Text>
      {account.kind === 'storage_unavailable' && <Action label={t('oath.retry')} onPress={() => { void controller.refresh(); }} />}
    </>}
    {available && <>
      <View style={styles.navigation}>{(['today', 'history'] as const).map(destination => <Pressable key={destination}
        accessibilityRole="button" accessibilityLabel={t(`oathHome.${destination}`)} accessibilityState={{ selected: route === 'list' && view === destination, disabled: mutating }} disabled={mutating}
        onPress={() => { void loadList(destination); }} style={[styles.tab, route === 'list' && view === destination && styles.selectedTab]}>
        <Text style={styles.label}>{t(`oathHome.${destination}`)}</Text>
      </Pressable>)}</View>
      {route === 'list' && list?.paused && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oathHome.paused')}</Text>}
      {route === 'list' && view === 'today' && <>
        <Text style={styles.subtitle}>{t('forge.subtitle')}</Text>
        <ForgeHub items={list?.items ?? []} onOpen={id => { void openDetail(id); }} onCreate={account.pending || list?.paused ? undefined : () => create()} createDisabled={account.busy || mutating} />
      </>}
      {route === 'list' && (account.pending ? <>
        <Text style={styles.body}>{t('oath.pending')}</Text>
        <Action label={t('oath.recover')} busy={account.busy || mutating} onPress={() => create(true)} />
      </> : !list?.paused && (view !== 'today' || !interactiveForge) && <Action label={t('oathHome.create')} busy={account.busy || mutating} onPress={() => create()} />)}
      {route === 'list' && <Pressable accessibilityRole="button" accessibilityLabel={t('oathHome.pause')} accessibilityState={{ disabled: mutating }} disabled={mutating} style={styles.pauseControl} onPress={() => { void showPause(); }}><Text accessible={false} style={styles.pauseIcon}>Ⅱ</Text><Text style={styles.pauseText}>{t('forge.pauseShort')}</Text></Pressable>}
      {loading && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oathHome.loading')}</Text>}
      {route === 'list' && <>
        {view === 'today' && !!list?.items.length && <Text accessibilityRole="header" style={styles.label}>{t('forge.all')}</Text>}
        {list?.items.map((item, index) => <View key={item.id} style={styles.card}>
          {view === 'today' && (index === 0 || category(item) !== category(list.items[index - 1])) && <Text accessibilityRole="header" style={styles.label}>{t(`oathHome.${category(item)}`)}</Text>}
          {(index === 0 || group(item) !== group(list.items[index - 1])) && <Text accessibilityRole="header" style={styles.label}>{group(item)}</Text>}
          <Text style={styles.body}>{t(`oath.states.${item.state}`)}</Text>
          <Action label={summary(item, true)} variant="secondary" onPress={() => { void openDetail(item.id); }} />
        </View>)}
        {!loading && !failed && list?.items.length === 0 && <Text style={styles.body}>{t(view === 'today' ? 'oathHome.emptyToday' : 'oathHome.emptyHistory')}</Text>}
        {failed && <><Text accessibilityLiveRegion="polite" style={styles.body}>{t('oathHome.loadError')}</Text><Action label={t('oath.retry')} onPress={() => { void loadList(view, !!list?.nextCursor); }} /></>}
        {list?.nextCursor && !failed && <Action label={t('oathHome.more')} busy={loading} onPress={() => { void loadList(view, true); }} />}
        <Action label={t('oathHome.refresh')} busy={loading} variant="secondary" onPress={() => { void loadList(view); }} />
      </>}
      {route === 'detail' && <>
        {failed && <><Text style={styles.body}>{t('oathHome.detailError')}</Text><Action label={t('oath.retry')} onPress={() => { void openDetail(detailId.current); }} /></>}
        {detail && <>
          <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oath.state', { state: t(`oath.states.${detail.state}`) })}</Text>
          {detail.reason === 'service_availability_unknown' && <Text style={styles.body}>{t('oathHome.unknownAvailability')}</Text>}
          {detail.reason === 'account_paused' && <Text style={styles.body}>{t('oathHome.withdrawn')}</Text>}
          {detail.review && <Text style={styles.body}>{t('oathHome.reviewDeadline', { deadline: formatDeadline(new Date(detail.review.closesAt), locale, 'UTC') })}</Text>}
          <SnapshotRules snapshot={detail.snapshot} />
        </>}
      </>}
      {route === 'pause' && <>
        {pauseChanged && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oathHome.pauseChanged')}</Text>}
        {(failed || pauseFailed) && <><Text style={styles.body}>{t(pauseFailed ? 'oathHome.pauseError' : 'oathHome.loadError')}</Text><Action label={t('oathHome.reviewPause')} onPress={() => { void showPause(); }} /></>}
        {pause && <>
          <Text style={styles.body}>{t(pause.summary.paused ? 'oathHome.paused' : 'oathHome.pauseIntro')}</Text>
          {(['withdraw', 'preserve'] as const).map(key => <View key={key} style={styles.card}>
            <Text accessibilityRole="header" style={styles.label}>{t(`oathHome.${key}`)}</Text>
            {pause[key].length === 0 && <Text style={styles.body}>{t('oathHome.none')}</Text>}
            {pause[key].map(item => <Text key={item.id} style={styles.body}>{summary(item)}</Text>)}
          </View>)}
          <Action label={t(pause.summary.paused ? 'oathHome.resume' : 'oathHome.confirmPause')} busy={mutating} onPress={() => { void changePause(); }} />
        </>}
      </>}
    </>}
    <Action label={t('auth.signOut')} variant="secondary" onPress={onLogout} />
  </Animated.ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas }, content: { flexGrow: 1, padding: tokens.space.card, gap: tokens.space.section }, card: { gap: tokens.space.item, backgroundColor: tokens.color.surface, padding: 16, borderRadius: 20 },
  navigation: { flexDirection: 'row', gap: 24 }, tab: { flex: 1, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, selectedTab: { borderBottomColor: tokens.color.primary }, pauseControl: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12 }, pauseIcon: { color: tokens.color.primary, fontSize: 22 }, pauseText: { color: tokens.color.secondary, fontSize: 15 }, subtitle: { color: tokens.color.secondary, fontSize: 17, lineHeight: 25 },
  title: { color: tokens.color.text, fontSize: tokens.title, fontWeight: '600' }, label: { color: tokens.color.text, fontSize: tokens.body, fontWeight: '600' }, body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
