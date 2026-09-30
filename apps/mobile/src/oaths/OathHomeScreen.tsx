import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { bindShortWords } from '../localization/typography';
import type { GuideStorage } from '../forge/guideStorage';
import { Animated, AppState, Image, Pressable, RefreshControl, SafeAreaView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import type { Oath, OathListEnvelope } from '../api/oathSchema';
import type { NetworkEvents } from '../api/networkEvents';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import { SceneDoor } from '../ui/SceneDoor';
import { BackLink } from '../ui/BackLink';
import { compactStoredTime, shortStoredTime, wallTimeIn } from './compactStoredTime';
import { CountdownChip } from './CountdownChip';
import { OathRuleCards } from './OathRuleCards';
import { LIST_DROP, SceneSurface, type ForgePlace } from '../ui/SceneSurface';
import { StateSeal } from '../ui/StateSeal';
import { CompanionBubble } from '../ui/CompanionBubble';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { storedTime } from './SnapshotRules';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import { ForgeHub } from './ForgeHub';
import { OathScreen, type OathCreationDraft } from './OathScreen';
import type { OathController } from './controller';
import { layoutMode } from '../ui/layoutMode';
import { useArt } from '../art/ArtProvider';
type ViewName = 'today' | 'history';
/** flown: the room already flew into the place, so its screen opens without a second zoom. */
/** onReturn names the place on screen, so the room flies back out of it. */
export type ForgeNavigation = { request: { id: number; target: 'create' | ViewName; flown?: boolean } | null; onReturn(place: 'hearth' | 'seals' | 'chronicle'): void };
/** reload: a new value reloads the visible list, for example after a pause change made in Settings. */
/** network: a reconnect reloads the visible list, like a return to the foreground. */
export function OathHomeScreen({ controller, timezone, forgeNavigation, reload = 0, rulesGuideStorage, network }: { controller: OathController; timezone: string; forgeNavigation?: ForgeNavigation; reload?: number; rulesGuideStorage?: GuideStorage; network?: NetworkEvents }) {
  const chronicleIcon = useArt().talk.chronicle;
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
  // The screen stays mounted under the room. A new list request shows its view in the same render, so the first visible
  // frame is never the previous view (native check, 2026-09-30). The effect below still loads it.
  const [shownRequest, setShownRequest] = useState<number | null>(null);
  const incoming = available ? forgeNavigation?.request : null;
  if (incoming && incoming.id !== shownRequest) {
    setShownRequest(incoming.id);
    if (incoming.target !== 'create') { setRoute('list'); setView(incoming.target); setList(null); setLoading(true); setFailed(false); setBusyNotice(false); }
    else if (route !== 'create' && account.kind === 'ready' && !account.pending) { setHearthRequest(true); setBusyNotice(false); }
  }
  const confirmedId = available ? account.oath?.id : undefined;
  const current = (epoch: number) => epoch === generation.current;
  /** quiet: the shown list stays until the answer replaces it, for automatic refreshes and the pull gesture. */
  async function loadList(nextView: ViewName, append = false, quiet = false) {
    const epoch = ++generation.current;
    const previous = append ? list : null;
    const cursor = append ? list?.nextCursor : null;
    setRoute('list'); setView(nextView); setFailed(false); setBusyNotice(false);
    if (!quiet) setLoading(true);
    if (!append && !quiet) setList(null);
    const result = await controller.list({ view: nextView, ...(cursor ? { cursor } : {}) });
    if (!current(epoch)) return;
    if (!quiet) setLoading(false);
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
  // The list keeps itself current: coming back to the app or to the network asks the server again. A detail or creation is left alone.
  const shown = useRef({ route, view, available }); shown.current = { route, view, available };
  function refreshShownList() {
    if (shown.current.available && shown.current.route === 'list') void loadList(shown.current.view, false, true);
  }
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refreshShownList(); });
    return () => subscription.remove();
  }, [controller]);
  useEffect(() => network?.onReconnect(refreshShownList), [controller, network]);
  const [pulling, setPulling] = useState(false);
  async function pull() {
    setPulling(true);
    try { await loadList(view, false, true); } finally { setPulling(false); }
  }
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
  // A countdown reaching zero asks for the same detail again, quietly. Only the server's answer changes the state shown.
  async function refreshDetail(id: string) {
    const epoch = generation.current;
    const result = await controller.detail(id);
    if (!current(epoch) || detailId.current !== id) return;
    if (result.kind === 'success' && result.value.oath.id === id) setDetail(result.value.oath);
  }
  function create(recover = false) {
    if (!recover && !controller.resetCreation()) return false;
    generation.current++; setRoute('create'); return true;
  }
  // A countdown reaching zero asks the server for Today once, however many chips show it. Only the answer changes state.
  const elapsedAt = useRef<number | null>(null);
  function elapsed() {
    const now = controller.clock.now() ?? 0;
    if (elapsedAt.current !== null && now - elapsedAt.current < 1000) return;
    elapsedAt.current = now; void loadList('today', false, true);
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
  if (available && route === 'create') return <OathScreen approach={approach?.place === 'hearth' ? approach.id : null} controller={controller} timezone={timezone} rulesGuideStorage={rulesGuideStorage} onViewOath={id => { void openDetail(id); }} initialDraft={creationDraft} onDraftChange={setCreationDraft} backLabel={forgeNavigation ? returnLabel : undefined} backPlain={!!forgeNavigation && !interactiveForge} onBack={forgeNavigation ? () => forgeNavigation.onReturn('hearth') : () => { void loadList('today'); }} />;
  // In the room layout every list and detail leaves a band under the tabs (Today's hub, the chronicle band, the detail emblem). The close-up is lowered into it.
  // While a hearth request waits for Today, only the hearth shows at the creation screen's framing. Creation or the list with its notice follows.
  // The same surface stays mounted, so its close-ups are already decoded.
  const waiting = available && hearthRequest;
  return <SceneSurface place={place} drop={interactiveForge && !waiting ? LIST_DROP : 0} scroll={scroll} approach={approach && approach.place === place && place !== 'hearth' ? approach.id : null}>{waiting ? <SafeAreaView testID="hearth-waiting" style={styles.safeArea}><View style={styles.content}>
    {forgeNavigation && (interactiveForge
      ? <SceneDoor label={returnLabel} onPress={() => forgeNavigation.onReturn('hearth')} />
      : <BackLink label={returnLabel} onPress={() => forgeNavigation.onReturn('hearth')} />)}
    <SlowNotice text={t('oathHome.loading')} />
  </View></SafeAreaView> : <SafeAreaView style={styles.safeArea}><Animated.ScrollView testID="oath-list-scroll" style={entrance} key={`${route}-${view}`} contentContainerStyle={styles.content}
    refreshControl={available && route === 'list' ? <RefreshControl refreshing={pulling} onRefresh={() => pull()} tintColor={tokens.color.primary} /> : undefined} scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], { useNativeDriver: true })}>
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
      {/* The lowered chronicle close-up shows its book in this band, so no text crosses it. */}
      {route === 'list' && view === 'history' && interactiveForge && <View testID="chronicle-band" style={styles.chronicleBand} />}
      {route === 'list' && view === 'today' && <>
        <ForgeHub items={list?.items ?? []} clock={controller.clock} onElapsed={elapsed} onOpen={id => { void openDetail(id); }} onCreate={account.pending || list?.paused ? undefined : () => create()} createDisabled={account.busy} />
      </>}
      {route === 'list' && (account.pending ? <>
        <CompanionBubble message={t('oath.pending')} />
        <Action label={t('oath.recover')} busy={account.busy} onPress={() => create(true)} />
      </> : !list?.paused && (view !== 'today' || !interactiveForge) && <Action label={t('oathHome.create')} busy={account.busy} onPress={() => create()} />)}
      {loading && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oathHome.loading')}</Text>}
      {route === 'list' && view === 'history' && list && <View testID="history-header" style={styles.historyHeader}>
        <View accessible accessibilityLabel={`${list.total} ${t('room.talk.chronicle', { count: list.total })}`} style={styles.historyCount}>
          <Image source={chronicleIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.historyIcon} />
          <Text style={styles.historyTotal}>{list.total}</Text>
          <Text style={styles.historyLabel}>{bindShortWords(t('room.talk.chronicle', { count: list.total }), locale)}</Text>
        </View>
        <CompanionBubble message={t(list.total > 0 ? 'oathHome.historyLine' : 'oathHome.historyEmpty')} />
      </View>}
      {route === 'list' && <>
        {view === 'today' && !!list?.items.length && <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.section}>{t('forge.all')}</Text>}
        {list?.items.map((item, index) => <View key={item.id} style={styles.entry}>
          {view === 'today' && (index === 0 || category(item) !== category(list.items[index - 1])) && <Text accessibilityRole="header" style={styles.label}>{t(`oathHome.${category(item)}`)}</Text>}
          {view === 'today' && (index === 0 || category(item) !== category(list.items[index - 1]) || group(item) !== group(list.items[index - 1])) && <Text accessibilityRole="header" style={styles.group}>{group(item)}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={summary(item)} accessibilityValue={{ text: t(`oath.states.${item.state}`) }} onPress={() => { void openDetail(item.id); }}
            style={({ pressed }) => [styles.journalEntry, !interactiveForge && styles.stackedEntry, pressed && styles.pressedEntry]}>
            <View style={styles.emblems}>
              <ActivityEmblem activity={item.snapshot.activity} size={76} />
              <View style={styles.stateBadge}><StateSeal state={item.state} size={36} /></View>
            </View>
            <View style={styles.entryCopy}>
              <Text style={styles.activity}>{item.snapshot.copy[locale].activity}</Text>
              {view === 'today' && <Text style={styles.state}>{t(`oath.states.${item.state}`)}</Text>}
              {/* History rows show the result seal, the activity and when it closed, in the Oath's own zone. */}
              <Text style={styles.deadline}>{view === 'history' ? compactStoredTime(item.terminalAt ? wallTimeIn(item.terminalAt, item.snapshot.deadline.timezone) : item.snapshot.deadline.local, locale) : shortStoredTime(item.snapshot.deadline.local, locale, false)}</Text>
              {view === 'today' && <CountdownChip oath={item} clock={controller.clock} onElapsed={elapsed} />}
            </View>
          </Pressable>
        </View>)}
        {!loading && !failed && list?.items.length === 0 && view === 'today' && <CompanionBubble message={t('oathHome.emptyToday')} />}
        {failed && <><View accessibilityLiveRegion="polite"><CompanionBubble message={t('oathHome.loadError')} /></View><Action label={t('oath.retry')} onPress={() => { void loadList(view, !!list?.nextCursor); }} /></>}
        {list?.nextCursor && !failed && <Action label={t('oathHome.more')} busy={loading} onPress={() => { void loadList(view, true); }} />}
      </>}
      {route === 'detail' && <>
        {failed && <><CompanionBubble message={t('oathHome.detailError')} /><Action label={t('oath.retry')} onPress={() => { void openDetail(detailId.current); }} /></>}
        {detail && <>
          {/* In the room layout the emblem stands on the middle plinth of the lowered seal wall, the text starts on the floor below it. */}
          <View style={[styles.detailHero, interactiveForge && styles.detailWall]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityEmblem activity={detail.snapshot.activity} size={108} /></View>
          <View style={styles.detailHead}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.detailTitle}>{detail.snapshot.copy[locale].title}</Text>
            <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.detailActivity}>{detail.snapshot.copy[locale].activity}</Text>
          </View>
          {/* One centred panel answers where the Oath stands: state, time left, the closing moment in the Oath's zone and why. */}
          <View testID="detail-status" style={styles.statusPanel}>
            <View accessible accessibilityLabel={t('oath.state', { state: t(`oath.states.${detail.state}`) })} accessibilityLiveRegion="polite" style={styles.detailState}>
              <StateSeal state={detail.state} size={56} />
              <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.detailStateLabel}>{t(`oath.states.${detail.state}`)}</Text>
            </View>
            <CountdownChip oath={detail} clock={controller.clock} size="large" onElapsed={() => { void refreshDetail(detail.id); }} />
            {detail.review && <Text style={styles.statusTime}>{t('oathHome.reviewDeadline', { deadline: compactStoredTime(wallTimeIn(detail.review.closesAt, detail.snapshot.deadline.timezone), locale) })}</Text>}
            {detail.terminalAt && <Text style={styles.statusTime}>{t('oathHome.closedAt', { time: compactStoredTime(wallTimeIn(detail.terminalAt, detail.snapshot.deadline.timezone), locale) })}</Text>}
            {detail.reason === 'service_availability_unknown' && <Text style={styles.statusReason}>{t('oathHome.unknownAvailability')}</Text>}
            {detail.reason === 'character_paused' && <Text style={styles.statusReason}>{t('oathHome.withdrawn')}</Text>}
          </View>
          <OathRuleCards snapshot={detail.snapshot} head="promise" />
        </>}
      </>}
    </>}
  </Animated.ScrollView></SafeAreaView>}</SceneSurface>;
}
/** A waiting line that appears only when the answer is slow, so a fast answer never flashes it (native check, 2026-09-30). */
function SlowNotice({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const wait = setTimeout(() => setShown(true), SLOW_MS); return () => clearTimeout(wait); }, []);
  return shown ? <Text accessibilityLiveRegion="polite" style={styles.body}>{text}</Text> : null;
}
const SLOW_MS = 500;
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  historyHeader: { gap: 12 },
  historyCount: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#8a6436', backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  historyIcon: { width: 48, height: 48 },
  historyTotal: { color: tokens.color.primary, fontSize: 32, fontWeight: '700' },
  historyLabel: { color: tokens.color.text, fontSize: 17, flexShrink: 1 },
  content: { flexGrow: 1, paddingHorizontal: tokens.space.card, paddingTop: 24, paddingBottom: 36, gap: tokens.space.section },
  entry: { gap: 10 },
  // The list opens under the seal wall with a rule and a display heading, then state and date step down in size.
  section: { color: '#f3dfbd', fontFamily: tokens.font.display, fontSize: 22, lineHeight: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(141, 105, 65, 0.55)', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  group: { color: tokens.color.secondary, fontSize: 14, lineHeight: 20, marginTop: -4 },
  journalEntry: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: 'rgba(32, 28, 23, 0.94)', borderRadius: 8, borderTopWidth: 1, borderTopColor: '#8d6941', borderBottomWidth: 3, borderBottomColor: '#080c0d', boxShadow: '0 6px 18px rgba(0,0,0,0.3)' },
  stackedEntry: { flexDirection: 'column', alignItems: 'flex-start' },
  pressedEntry: { backgroundColor: '#493721', borderTopColor: '#f0bd76', transform: [{ scale: 0.98 }] },
  entryCopy: { flexShrink: 1, gap: 6 },
  activity: { color: '#f4deb7', fontSize: 21, lineHeight: 29, fontWeight: '600' },
  state: { color: '#edba78', fontSize: 15, lineHeight: 22 },
  deadline: { color: '#ded1bd', fontSize: 14, lineHeight: 22 },
  detailHero: { alignItems: 'center', paddingTop: 4 },
  // Matches the Today hub band, so the emblem meets the same plinth whether the list or the detail is open.
  detailWall: { height: 262, justifyContent: 'flex-end', paddingTop: 0 },
  chronicleBand: { height: 262 },
  detailHead: { alignItems: 'center', gap: 4, marginTop: -8 },
  detailTitle: { color: '#f3dfbd', fontFamily: tokens.font.display, fontSize: tokens.title, lineHeight: 36, textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  detailActivity: { color: tokens.color.primary, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 2.4, textTransform: 'uppercase', textAlign: 'center' },
  statusPanel: { alignItems: 'center', gap: 14, paddingVertical: 20, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, borderColor: '#5b4630', backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  statusTime: { color: '#ded1bd', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  statusReason: { color: tokens.color.secondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  detailState: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailStateLabel: { color: '#edba78', fontFamily: tokens.font.display, fontSize: 20, lineHeight: 28, flexShrink: 1 },
  emblems: { width: 84, height: 84 },
  stateBadge: { position: 'absolute', right: -6, bottom: -6 },
  parchment: { backgroundColor: 'rgba(27, 24, 20, 0.95)', padding: 18, borderTopWidth: 2, borderTopColor: '#9d7b4d', borderBottomWidth: 2, borderBottomColor: '#5d452c', borderRadius: 5 },
  navigation: { flexDirection: 'row', gap: 24, backgroundColor: 'rgba(17, 19, 21, 0.5)', borderRadius: 8 }, stackedNavigation: { flexDirection: 'column', gap: 8 }, stackedTab: { flex: 0, alignItems: 'flex-start' },
  tab: { flex: 1, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#5d4e39' },
  selectedTab: { borderBottomColor: '#f3bc72', backgroundColor: 'rgba(127, 87, 41, 0.18)' },
  title: { color: '#f3dfbd', fontSize: 28, fontFamily: tokens.font.display, fontWeight: '400', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 }, label: { color: tokens.color.text, fontSize: tokens.body, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }, body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
