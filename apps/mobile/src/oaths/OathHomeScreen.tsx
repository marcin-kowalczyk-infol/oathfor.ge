import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GuideStorage } from '../forge/guideStorage';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { formatDeadline } from '../localization/format';
import type { Oath, OathListEnvelope } from '../api/oathSchema';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import { SceneDoor } from '../ui/SceneDoor';
import { BackLink } from '../ui/BackLink';
import { compactStoredTime } from './compactStoredTime';
import { SceneSurface, type ForgePlace } from '../ui/SceneSurface';
import { StateSeal } from '../ui/StateSeal';
import { CompanionBubble } from '../ui/CompanionBubble';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { SnapshotRules, storedTime } from './SnapshotRules';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import { ForgeHub } from './ForgeHub';
import { OathScreen, type OathCreationDraft } from './OathScreen';
import type { OathController } from './controller';
import { layoutMode } from '../ui/layoutMode';
type ViewName = 'today' | 'history';
/** flown: the room already flew into the place, so its screen opens without a second zoom. */
/** onReturn names the place on screen, so the room flies back out of it. */
export type ForgeNavigation = { request: { id: number; target: 'create' | ViewName; flown?: boolean } | null; onReturn(place: 'hearth' | 'seals' | 'chronicle'): void };
/** reload: a new value reloads the visible list, for example after a pause change made in Settings. */
export function OathHomeScreen({ controller, timezone, forgeNavigation, reload = 0, rulesGuideStorage }: { controller: OathController; timezone: string; forgeNavigation?: ForgeNavigation; reload?: number; rulesGuideStorage?: GuideStorage }) {
  const { t, i18n } = useTranslation(); const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { width, fontScale } = useWindowDimensions();
  const interactiveForge = layoutMode(width, fontScale) === 'room';
  // The room is the way back in room layout. Without the room the header returns to the menu.
  const returnLabel = t(interactiveForge ? 'forge.returnRoom' : 'forge.returnMenu');
  const account = useSyncExternalStore(controller.subscribe, controller.getState);
  const available = account.kind === 'ready';
  const [route, setRoute] = useState<'list' | 'detail' | 'create'>('list');
  const [creationDraft, setCreationDraft] = useState<OathCreationDraft | null>(null);
  useEffect(() => { setCreationDraft(null); }, [controller]);
  const [view, setView] = useState<ViewName>('today');
  const entrance = useSceneEntrance(`${route}-${view}`);
  const scroll = useRef(new Animated.Value(0)).current;
  useEffect(() => { scroll.setValue(0); }, [route, view, scroll]);
  const [list, setList] = useState<OathListEnvelope | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<Oath | null>(null);
  const detailId = useRef('');
  const generation = useRef(0);
  // Room arrival drives only the backdrop approach and the busy notice, never Oath state.
  const [arrival, setArrival] = useState<{ id: number; place: ForgePlace; flown: boolean } | null>(null);
  const [hearthRequest, setHearthRequest] = useState(false);
  const [busyNotice, setBusyNotice] = useState(false);
  const confirmedId = available ? account.oath?.id : undefined;
  const current = (epoch: number) => epoch === generation.current;
  async function loadList(nextView: ViewName, append = false) {
    const epoch = ++generation.current;
    const previous = append ? list : null;
    const cursor = append ? list?.nextCursor : null;
    setRoute('list'); setView(nextView); setFailed(false); setLoading(true); setBusyNotice(false);
    if (!append) setList(null);
    const result = await controller.list({ view: nextView, ...(cursor ? { cursor } : {}) });
    if (!current(epoch)) return;
    setLoading(false);
    if (result.kind !== 'success') { setFailed(true); return; }
    // Live pagination can repeat rows after server changes; keep the returned order of new rows.
    const existing = new Set(previous?.items.map(item => item.id));
    setList({ ...result.value, items: previous ? [...previous.items, ...result.value.items.filter(item => !existing.has(item.id))] : result.value.items });
    return result.value;
  }
  useEffect(() => {
    if (available) void loadList('today');
    return () => { generation.current++; };
  }, [available, controller]);
  useEffect(() => {
    if (confirmedId) {
      setCreationDraft(null);
      if (route === 'list') void loadList(view);
    }
  }, [confirmedId]);
  const reloaded = useRef(reload);
  useEffect(() => {
    if (reloaded.current === reload) return;
    reloaded.current = reload;
    // A detail or an unfinished creation stays open. The list loads again when the player returns to it.
    if (available && route === 'list') void loadList(view);
  }, [reload]);
  async function openDetail(id: string) {
    const epoch = ++generation.current; detailId.current = id;
    setRoute('detail'); setDetail(null); setLoading(true); setFailed(false);
    const result = await controller.detail(id);
    if (!current(epoch)) return;
    setLoading(false);
    if (result.kind === 'success' && result.value.oath.id === id) setDetail(result.value.oath);
    else setFailed(true);
  }
  function create(recover = false) {
    if (!recover && !controller.resetCreation()) return false;
    generation.current++; setRoute('create'); return true;
  }
  const handledRequest = useRef<number | null>(null);
  useEffect(() => {
    const request = forgeNavigation?.request;
    if (!available || !request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    // A newer room request supersedes an unfinished hearth request and its backdrop.
    setHearthRequest(false);
    setArrival({ id: request.id, place: request.target === 'create' ? 'hearth' : request.target === 'today' ? 'seals' : 'chronicle', flown: !!request.flown });
    if (request.target === 'create') {
      if (route === 'create') return;
      if (account.pending) { create(true); return; }
      setHearthRequest(true);
      void loadList('today').then(result => {
        if (handledRequest.current !== request.id) return;
        setHearthRequest(false);
        if (!result || result.paused) return;
        const latest = controller.getState();
        if (latest.kind === 'ready' && !create(!!latest.pending)) setBusyNotice(true);
      });
    } else void loadList(request.target);
  }, [forgeNavigation?.request?.id, available]);
  function summary(item: Oath) { return t('oathHome.open', { activity: item.snapshot.copy[locale].activity, deadline: storedTime(item.snapshot.deadline, locale) }); }
  function category(item: Oath) { return item.state === 'scheduled' ? 'future' : item.state === 'active' ? 'current' : 'pending'; }
  function group(item: Oath) {
    const date = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.snapshot.deadline.local}Z`));
    return t('oathHome.group', { date, timezone: item.snapshot.deadline.timezone });
  }
  const place: ForgePlace = hearthRequest ? 'hearth' : route === 'detail' ? 'seals' : view === 'history' ? 'chronicle' : 'seals';
  // After the room's own flight the close-up is already in view, so the screen skips its zoom.
  const approach = arrival && !arrival.flown ? arrival : null;
  if (available && route === 'create') return <OathScreen approach={approach?.place === 'hearth' ? approach.id : null} controller={controller} timezone={timezone} rulesGuideStorage={rulesGuideStorage} initialDraft={creationDraft} onDraftChange={setCreationDraft} backLabel={forgeNavigation ? returnLabel : undefined} backPlain={!!forgeNavigation && !interactiveForge} onBack={forgeNavigation ? () => forgeNavigation.onReturn('hearth') : () => { void loadList('today'); }} />;
  // Today's hub leaves an empty band under the tabs. The seal wall is lowered into it.
  return <SceneSurface place={place} drop={route === 'list' && view === 'today' && interactiveForge ? 0.3 : 0} scroll={scroll} approach={approach && approach.place === place && place !== 'hearth' ? approach.id : null}><SafeAreaView style={styles.safeArea}><Animated.ScrollView style={entrance} key={`${route}-${view}`} contentContainerStyle={styles.content} scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], { useNativeDriver: true })}>
    {forgeNavigation && (interactiveForge
      ? <SceneDoor label={returnLabel} onPress={() => forgeNavigation.onReturn(place)} />
      : <BackLink label={returnLabel} onPress={() => forgeNavigation.onReturn(place)} />)}
    <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t(route === 'detail' ? 'forge.detail' : view === 'today' ? 'forge.title' : 'oathHome.history')}</Text>
    {!available && <>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{t(account.kind === 'storage_unavailable' ? 'oath.storageError' : 'oathHome.loading')}</Text>
      {account.kind === 'storage_unavailable' && <Action label={t('oath.retry')} onPress={() => { void controller.refresh(); }} />}
    </>}
    {available && <>
      <View style={[styles.navigation, !interactiveForge && styles.stackedNavigation]}>{(['today', 'history'] as const).map(destination => <Pressable key={destination}
        accessibilityRole="button" accessibilityLabel={t(`oathHome.${destination}`)} accessibilityState={{ selected: route === 'list' && view === destination }}
        onPress={() => { void loadList(destination); }} style={[styles.tab, !interactiveForge && styles.stackedTab, route === 'list' && view === destination && styles.selectedTab]}>
        {/* Tabs are sans functional text, capped because the MVP-05 native check saw them break mid-word at the maximum size. */}
        <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.label}>{t(`oathHome.${destination}`)}</Text>
      </Pressable>)}</View>
      {route === 'list' && list?.paused && <View accessibilityLiveRegion="polite"><CompanionBubble message={t('oathHome.paused')} /></View>}
      {route === 'list' && busyNotice && <View accessibilityLiveRegion="polite"><CompanionBubble message={t('forge.busy')} /></View>}
      {route === 'list' && view === 'today' && <>
        <ForgeHub items={list?.items ?? []} onOpen={id => { void openDetail(id); }} onCreate={account.pending || list?.paused ? undefined : () => create()} createDisabled={account.busy} />
      </>}
      {route === 'list' && (account.pending ? <>
        <CompanionBubble message={t('oath.pending')} />
        <Action label={t('oath.recover')} busy={account.busy} onPress={() => create(true)} />
      </> : !list?.paused && (view !== 'today' || !interactiveForge) && <Action label={t('oathHome.create')} busy={account.busy} onPress={() => create()} />)}
      {loading && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oathHome.loading')}</Text>}
      {route === 'list' && <>
        {view === 'today' && !!list?.items.length && <Text accessibilityRole="header" style={styles.label}>{t('forge.all')}</Text>}
        {list?.items.map((item, index) => <View key={item.id} style={styles.entry}>
          {view === 'today' && (index === 0 || category(item) !== category(list.items[index - 1])) && <Text accessibilityRole="header" style={styles.label}>{t(`oathHome.${category(item)}`)}</Text>}
          {view === 'today' && (index === 0 || group(item) !== group(list.items[index - 1])) && <Text accessibilityRole="header" style={styles.label}>{group(item)}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={summary(item)} accessibilityValue={{ text: t(`oath.states.${item.state}`) }} onPress={() => { void openDetail(item.id); }}
            style={({ pressed }) => [styles.journalEntry, !interactiveForge && styles.stackedEntry, pressed && styles.pressedEntry]}>
            <View style={styles.emblems}>
              <ActivityEmblem activity={item.snapshot.activity} size={76} />
              <View style={styles.stateBadge}><StateSeal state={item.state} size={36} /></View>
            </View>
            <View style={styles.entryCopy}>
              <Text style={styles.activity}>{item.snapshot.copy[locale].activity}</Text>
              <Text style={styles.state}>{t(`oath.states.${item.state}`)}</Text>
              <Text style={styles.deadline}>{view === 'history' ? compactStoredTime(item.snapshot.deadline.local, locale) : storedTime(item.snapshot.deadline, locale)}</Text>
            </View>
          </Pressable>
        </View>)}
        {!loading && !failed && list?.items.length === 0 && <CompanionBubble message={t(view === 'today' ? 'oathHome.emptyToday' : 'oathHome.emptyHistory')} />}
        {failed && <><View accessibilityLiveRegion="polite"><CompanionBubble message={t('oathHome.loadError')} /></View><Action label={t('oath.retry')} onPress={() => { void loadList(view, !!list?.nextCursor); }} /></>}
        {list?.nextCursor && !failed && <Action label={t('oathHome.more')} busy={loading} onPress={() => { void loadList(view, true); }} />}
        <Action label={t('oathHome.refresh')} busy={loading} variant="secondary" onPress={() => { void loadList(view); }} />
      </>}
      {route === 'detail' && <>
        {failed && <><CompanionBubble message={t('oathHome.detailError')} /><Action label={t('oath.retry')} onPress={() => { void openDetail(detailId.current); }} /></>}
        {detail && <>
          <View style={styles.detailSeal}><ActivityEmblem activity={detail.snapshot.activity} size={108} /><Text style={styles.activity}>{detail.snapshot.copy[locale].activity}</Text></View>
          <View accessible accessibilityLabel={t('oath.state', { state: t(`oath.states.${detail.state}`) })} accessibilityLiveRegion="polite" style={styles.detailState}>
            <StateSeal state={detail.state} size={56} />
            <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.detailStateLabel}>{t(`oath.states.${detail.state}`)}</Text>
          </View>
          {detail.reason === 'service_availability_unknown' && <Text style={styles.body}>{t('oathHome.unknownAvailability')}</Text>}
          {detail.reason === 'character_paused' && <Text style={styles.body}>{t('oathHome.withdrawn')}</Text>}
          {detail.review && <Text style={styles.body}>{t('oathHome.reviewDeadline', { deadline: formatDeadline(new Date(detail.review.closesAt), locale, 'UTC') })}</Text>}
          <View style={styles.parchment}><SnapshotRules snapshot={detail.snapshot} /></View>
        </>}
      </>}
    </>}
  </Animated.ScrollView></SafeAreaView></SceneSurface>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: tokens.space.card, paddingTop: 24, paddingBottom: 36, gap: tokens.space.section },
  entry: { gap: 10 },
  journalEntry: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: 'rgba(32, 28, 23, 0.94)', borderRadius: 8, borderTopWidth: 1, borderTopColor: '#8d6941', borderBottomWidth: 3, borderBottomColor: '#080c0d', boxShadow: '0 6px 18px rgba(0,0,0,0.3)' },
  stackedEntry: { flexDirection: 'column', alignItems: 'flex-start' },
  pressedEntry: { backgroundColor: '#493721', borderTopColor: '#f0bd76', transform: [{ scale: 0.98 }] },
  entryCopy: { flexShrink: 1, gap: 6 },
  activity: { color: '#f4deb7', fontSize: 21, lineHeight: 29, fontWeight: '600' },
  state: { color: '#edba78', fontSize: 15, lineHeight: 22 },
  deadline: { color: '#ded1bd', fontSize: 14, lineHeight: 22 },
  detailSeal: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  detailState: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 12 },
  detailStateLabel: { color: '#edba78', fontFamily: tokens.font.display, fontSize: 20, lineHeight: 28, flexShrink: 1 },
  emblems: { width: 84, height: 84 },
  stateBadge: { position: 'absolute', right: -6, bottom: -6 },
  parchment: { backgroundColor: 'rgba(27, 24, 20, 0.95)', padding: 18, borderTopWidth: 2, borderTopColor: '#9d7b4d', borderBottomWidth: 2, borderBottomColor: '#5d452c', borderRadius: 5 },
  navigation: { flexDirection: 'row', gap: 24, backgroundColor: 'rgba(17, 19, 21, 0.5)', borderRadius: 8 }, stackedNavigation: { flexDirection: 'column', gap: 8 }, stackedTab: { flex: 0, alignItems: 'flex-start' },
  tab: { flex: 1, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#5d4e39' },
  selectedTab: { borderBottomColor: '#f3bc72', backgroundColor: 'rgba(127, 87, 41, 0.18)' },
  title: { color: '#f3dfbd', fontSize: 28, fontFamily: tokens.font.display, fontWeight: '400', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 }, label: { color: tokens.color.text, fontSize: tokens.body, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }, body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
