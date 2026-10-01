import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { bindShortWords } from '../localization/typography';
import type { GuideStorage } from '../forge/guideStorage';
import { Animated, AppState, Image, Pressable, RefreshControl, SafeAreaView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import type { Oath, OathListEnvelope } from '../api/oathSchema';
import type { NetworkEvents } from '../api/networkEvents';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import { SceneDoor } from '../ui/SceneDoor';
import { BackLink } from '../ui/BackLink';
import { compactStoredTime, pathTimeText, shortStoredTime, wallTimeIn } from './compactStoredTime';
import { CountdownChip } from './CountdownChip';
import { OathRuleCards } from './OathRuleCards';
import { DETAIL_DROP, LIST_DROP, SceneSurface, type ForgePlace } from '../ui/SceneSurface';
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
import type { ProofController, ProofControllerState } from '../proof/proofController';
import { deviceProof, deviceProofError, heldByServer, type ProofSubject } from './deviceProof';
import { errorMessage, ProofScreen } from '../proof/ProofScreen';
import { zoneLabel } from './zoneLabel';
import { oathPath } from './oathPath';
import { ruleIcon } from './oathArt';
import { SpriteFrame } from '../forge/Sprite';
import { StepBadge, StepTrack } from '../ui/StepTrack';
import { NextCard } from '../ui/NextCard';
import { ZaromirLine } from '../ui/ZaromirLine';
import { Disclosure } from '../ui/Disclosure';
import { zaromirSeed } from '../companion/zaromirLine';
type ViewName = 'today' | 'history';
// Without a proof controller nothing is waiting on the device.
const noProof: ProofControllerState = { kind: 'idle' };
const noProofStore = { subscribe: () => () => {}, getState: () => noProof };
const HOUR = 3600000;
// A longer timeout overflows and fires at once, so far moments are reached in steps.
const LONGEST_TIMER = 2 ** 31 - 1;
/** flown: the room already flew into the place, so its screen opens without a second zoom. */
/** onReturn names the place on screen, so the room flies back out of it. */
export type ForgeNavigation = { request: { id: number; target: 'create' | ViewName; flown?: boolean } | null; onReturn(place: 'hearth' | 'seals' | 'chronicle'): void };
/** reload: a new value reloads the visible list, for example after a pause change made in Settings. */
/** network: a reconnect reloads the visible list, like a return to the foreground. */
/** proof: the shell's one proof controller. An active detail offers "Submit proof" only when it is given. */
export function OathHomeScreen({ controller, timezone, forgeNavigation, reload = 0, rulesGuideStorage, network, proof }: { controller: OathController; timezone: string; forgeNavigation?: ForgeNavigation; reload?: number; rulesGuideStorage?: GuideStorage; network?: NetworkEvents; proof?: ProofController }) {
  const art = useArt(); const chronicleIcon = art.talk.chronicle;
  const { t, i18n } = useTranslation(); const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { width, fontScale } = useWindowDimensions();
  const interactiveForge = layoutMode(width, fontScale) === 'room';
  // The room is the way back in room layout. Without the room the header returns to the menu.
  const returnLabel = t(interactiveForge ? 'forge.returnRoom' : 'forge.returnMenu');
  const account = useSyncExternalStore(controller.subscribe, controller.getState);
  const available = account.kind === 'ready';
  const [route, setRoute] = useState<'list' | 'detail' | 'create' | 'proof'>('list');
  const [creationDraft, setCreationDraft] = useState<OathCreationDraft | null>(null);
  useEffect(() => { setCreationDraft(null); }, [controller]);
  const [view, setView] = useState<ViewName>('today');
  const entrance = useSceneEntrance(`${route}-${view}`);
  const scroll = useRef(new Animated.Value(0)).current;
  // The list a detail was opened from, and where that list was scrolled. Back from the detail returns there (MVP-22-T09e).
  // Opened from anywhere else (the proof screen, creation, a receipt) the detail goes back to Today.
  const [detailFrom, setDetailFrom] = useState<ViewName>('today');
  const offset = useRef(0);
  // Where a row opened the detail: that list and its scroll. Only a row sets it, so creation, a receipt or the proof screen return to the top (MVP-22-T12b).
  const leftAt = useRef<{ view: ViewName; y: number } | null>(null);
  const scrollKey = `${route}-${view}`;
  // One stable object per return, so later renders of the same list never scroll it again.
  const [restore, setRestore] = useState<{ key: string; at: { x: number; y: number } } | null>(null);
  const restoredAt = restore?.key === scrollKey ? restore.at : undefined;
  useEffect(() => {
    scroll.setValue(restoredAt?.y ?? 0); offset.current = restoredAt?.y ?? 0;
    // Leaving the restored list ends its restore, so a later visit through a tab starts at the top.
    if (restore && !restoredAt) setRestore(null);
  }, [route, view, scroll]);
  const [list, setList] = useState<OathListEnvelope | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingNow = useRef(false); loadingNow.current = loading;
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
  // The device's unresolved proof (MVP-07-T10). Its Oath shows the interrupted upload until the server answers a resend.
  const proofState = useSyncExternalStore(proof?.subscribe ?? noProofStore.subscribe, proof?.getState ?? noProofStore.getState);
  const proofReady = proofState.kind === 'ready' ? proofState : null;
  // The Oath whose upload the player resumed or deleted here. A refusal clears the record, so its reason shows through this.
  // An answer that was already there is not news, so the error at the press is kept to tell them apart.
  const [subject, setSubject] = useState<ProofSubject>(null);
  // A final refusal of a recorded proof, also from the automatic resend on load. The controller keeps its Oath after clearing the record.
  const lastRefusal = proofReady?.lastRefusal;
  const current = (epoch: number) => epoch === generation.current;
  /** quiet: the shown list stays until the answer replaces it, for automatic refreshes and the pull gesture. */
  /** merge: the return from a detail. Pages loaded beyond the first stay, so the kept scroll still finds its rows (MVP-22-T12b). */
  async function loadList(nextView: ViewName, append = false, quiet = false, merge = false) {
    const kept = merge ? list : null;
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
    // The fresh first page replaces its own rows. Rows of later pages that it does not hold stay, with the cursor past them.
    // When the fresh page says nothing follows, it is the whole list, so it replaces everything.
    if (kept && result.value.nextCursor !== null && kept.items.length > result.value.items.length) {
      const fresh = new Set(result.value.items.map(item => item.id));
      setList({ ...result.value, nextCursor: kept.nextCursor, items: [...result.value.items, ...kept.items.filter(item => !fresh.has(item.id))] });
      return result.value;
    }
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
  /** from: the list the player opened it from. Without one the way back leads to Today. at: that list's scroll, only when a row opened it. */
  async function openDetail(id: string, from: ViewName = 'today', at?: number) {
    const epoch = ++generation.current; detailId.current = id;
    leftAt.current = at === undefined ? null : { view: from, y: at };
    setDetailFrom(from); setRestore(null);
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
  // The detail's line moves at three moments the chip does not mark: under an hour before D, just after D and just after S.
  // oathPath compares strictly, so each moment is its boundary plus 1 ms. Just after D the line changes on the device, also offline.
  // Just after S the detail asks the server again, quietly. Until it answers the line already says the window closed.
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const shownDetail = route === 'detail' ? detail : null;
  useEffect(() => {
    if (!shownDetail || shownDetail.state !== 'active') return;
    const oathId = shownDetail.id, cutoff = Date.parse(shownDetail.snapshot.deadline.receiptCutoff), deadline = Date.parse(shownDetail.snapshot.deadline.utc);
    const moments = [deadline - HOUR + 1, deadline + 1, cutoff + 1];
    let timer: ReturnType<typeof setTimeout> | undefined;
    function arm() {
      clearTimeout(timer); timer = undefined;
      const now = controller.clock.now();
      const at = now === null ? undefined : moments.find(moment => moment > now);
      if (now === null || at === undefined) return;
      timer = setTimeout(() => {
        rerender();
        const later = controller.clock.now();
        if (later !== null && later > cutoff) void refreshDetail(oathId); else arm();
      }, Math.min(at - now, LONGEST_TIMER));
    }
    const stop = controller.clock.subscribe(arm); arm();
    return () => { clearTimeout(timer); stop(); };
  }, [shownDetail, controller]);
  function openFromList(id: string) {
    void openDetail(id, view, offset.current);
  }
  /** Back from the detail: the list it came from with its rows kept, refreshed quietly. Another list loads afresh. Only a row's own list gets its scroll back. */
  function returnToList() {
    const keep = route === 'detail' && view === detailFrom && list !== null;
    const at = keep && leftAt.current?.view === detailFrom ? leftAt.current.y : null;
    void loadList(detailFrom, false, keep, keep);
    if (at !== null) setRestore({ key: `list-${detailFrom}`, at: { x: 0, y: at } });
  }
  // The server's receipt is the detail now, shown as pending assessment.
  function showReceipt(oath: Oath) {
    generation.current++; detailId.current = oath.id; setDetailFrom('today'); setRestore(null); leftAt.current = null;
    setDetail(oath); setLoading(false); setFailed(false); setRoute('detail');
  }
  // A resend answered with a receipt: the controller holds the server's Oath, so the detail and Today show it.
  // The proof screen hands its own receipt over through onDone.
  const receivedOath = proofReady?.oath ?? null;
  useEffect(() => {
    if (!receivedOath) return;
    if (shown.current.route === 'detail' && detailId.current === receivedOath.id) setDetail(receivedOath);
    setList(current => current && { ...current, items: current.items.map(item => item.id === receivedOath.id ? receivedOath : item) });
  }, [receivedOath]);
  // A refused resend means the Oath moved on, for example past its cutoff. The server's current state replaces the shown one.
  // Only a refusal that arrives while the screen is open asks again. A shown list that is still loading gets its answer anyway.
  const seenRefusal = useRef(lastRefusal);
  useEffect(() => {
    if (!lastRefusal || seenRefusal.current === lastRefusal) { seenRefusal.current = lastRefusal; return; }
    seenRefusal.current = lastRefusal;
    if (shown.current.route === 'detail' && detailId.current === lastRefusal.oathId) void refreshDetail(lastRefusal.oathId);
    else if (shown.current.route === 'list' && shown.current.available && !loadingNow.current) void loadList(shown.current.view, false, true);
  }, [lastRefusal]);
  // The detail line the player is waiting on after their own press. It is read out until the first change after the send or delete ends,
  // so a later timer or language change stays quiet (MVP-22-T12b).
  const [announcing, setAnnouncing] = useState<{ oathId: string; line: string; busySeen: boolean } | null>(null);
  function pressed(oathId: string) { setAnnouncing({ oathId, line: shownDetailLine?.oathId === oathId ? shownDetailLine.line : '', busySeen: false }); }
  function resume(oathId: string) {
    if (!proof) return;
    setSubject({ oathId, before: proofReady?.error }); pressed(oathId); void proof.recover();
  }
  function discard(oathId: string) {
    if (!proof) return;
    setSubject({ oathId, before: proofReady?.error }); pressed(oathId); void proof.discard();
  }
  /**
   * The interrupted upload of one Today row: one line and the resend under the row (docs/product/clarity.md decision 9). Nothing here claims a receipt.
   * A final refusal stays on the row and the detail until the player dismisses it in the detail or sends again.
   * The long explanation of a waiting copy sits behind the detail's "Pełny opis".
   */
  function upload(oath: Oath) {
    const oathId = oath.id;
    const status = deviceProof(oath, proofState, subject);
    if (status === 'none') return null;
    const error = deviceProofError(oath, proofState, subject);
    const message = status === 'sending' || status === 'deleting' ? t(status === 'deleting' ? 'proof.deleting' : 'proof.sending') : error ? errorMessage(error, t) : t('path.next.interrupted');
    return <View testID="upload-interrupted" style={styles.upload}>
      <View accessibilityLiveRegion="polite"><Text style={styles.uploadText}>{message}</Text></View>
      {status === 'waiting' && <Action label={t('proof.retry')} onPress={() => resume(oathId)} />}
    </View>;
  }
  /**
   * The detail on the shared pieces (docs/product/clarity.md decisions 11 and 14): track, the "now and next" card, Żaromir's line,
   * then one link to the rules. The card's line is the path's next step, or the device's send status, or a refusal the player must act on.
   * Facts that sat in the status panel and other errors wait behind "Pełny opis". Only the server's answer changes the state shown.
   */
  /** The detail's path and card line, also read by the announcement effect. */
  function detailLine(oath: Oath) {
    const status = deviceProof(oath, proofState, subject);
    const error = deviceProofError(oath, proofState, subject);
    const now = controller.clock.now();
    // Without a list the pause is unknown, and the path keeps Żaromir silent where a pause could apply.
    const path = oathPath(oath, status, list ? list.paused : null, now);
    const time = path.next.time ? pathTimeText(path.next.time, locale) : undefined;
    // A refusal, or any error that followed the player's own resend or delete, replaces the line, so every press has visible feedback (clarity.md decision 3).
    const line = status === 'sending' || status === 'deleting' ? t(status === 'deleting' ? 'proof.deleting' : 'proof.sending')
      : error ? errorMessage(error, t) : t(path.next.key, { time, date: time });
    return { oathId: oath.id, status, now, path, line, busy: status === 'sending' || status === 'deleting' };
  }
  function detailPath(oath: Oath) {
    const zone = oath.snapshot.deadline.timezone;
    const { status, now, path, line } = detailLine(oath);
    const stored = (instant: string) => compactStoredTime(wallTimeIn(instant, zone), locale);
    // Only the server's receipt shows this. The receipt time is the server's, in the Oath's own zone.
    const received = oath.state === 'proof_pending' ? oath.proof : null;
    const facts: { text: string; time?: true }[] = [];
    if (received) facts.push({ text: t('oath.proofPending') }, { text: t('oathHome.receivedAt', { time: `${stored(received.receivedAt)} · ${zoneLabel(zone, t)}` }), time: true });
    if (oath.review) facts.push({ text: t('oathHome.reviewDeadline', { deadline: stored(oath.review.closesAt) }), time: true });
    if (oath.terminalAt) facts.push({ text: t('oathHome.closedAt', { time: stored(oath.terminalAt) }), time: true });
    if (oath.reason === 'service_availability_unknown') facts.push({ text: t('oathHome.unknownAvailability') });
    if (oath.reason === 'character_paused') facts.push({ text: t('oathHome.withdrawn') });
    // The interrupted copy's explanation. An error after a press is the line itself.
    const device = status === 'waiting' ? t('oathHome.uploadInterrupted') : null;
    const details = facts.length || device ? <View style={styles.facts}>
      {facts.map(fact => <Text key={fact.text} style={fact.time ? styles.statusTime : styles.statusReason}>{fact.text}</Text>)}
      {device && <Text testID="upload-interrupted" style={styles.statusReason}>{device}</Text>}
    </View> : undefined;
    // The only filled action. A copy waiting on the device is resent, never replaced by a new one.
    const action = !proof ? undefined : path.action === 'submitProof' ? { label: t('proof.submit'), onPress: () => { setSubject(null); setRoute('proof'); } }
      : path.action === 'sendAgain' ? { label: t('proof.retry'), onPress: () => resume(oath.id) } : undefined;
    const secondary = proof && status === 'waiting' ? <Action label={t('proof.discard')} variant="secondary" onPress={() => discard(oath.id)} />
      : proof && status === 'refused' ? <Action label={t('proof.dismiss')} variant="secondary" onPress={() => proof.dismissRefusal()} /> : undefined;
    return <>
      <StepTrack path={path} state={oath.state} activityEmblem={oath.snapshot.activity} />
      <NextCard oath={oath} clock={controller.clock} line={line} announceLine={announcing?.oathId === oath.id} onElapsed={() => { void refreshDetail(oath.id); }} action={action} secondary={secondary} details={details} />
      <ZaromirLine situation={path.zaromir} seed={path.zaromir ? zaromirSeed(oath.id, path.zaromir, now, zone) : ''} />
      <Disclosure label={t('path.rules')} icon={<SpriteFrame sheet={art.oaths.ruleIcons} index={ruleIcon.fullRules} width={36} />}>
        <OathRuleCards snapshot={oath.snapshot} head="promise" fold={false} />
      </Disclosure>
    </>;
  }
  const shownDetailLine = route === 'detail' && detail ? detailLine(detail) : null;
  // NextCard reads the changed line in its own effect, which runs before this one, so clearing here ends the announcement after it.
  useEffect(() => {
    if (!announcing) return;
    if (!shownDetailLine || shownDetailLine.oathId !== announcing.oathId) { setAnnouncing(null); return; }
    if (shownDetailLine.busy) { if (!announcing.busySeen) setAnnouncing({ ...announcing, busySeen: true }); return; }
    if (announcing.busySeen || shownDetailLine.line !== announcing.line) setAnnouncing(null);
  }, [announcing, shownDetailLine?.oathId, shownDetailLine?.line, shownDetailLine?.busy]);
  // A replay of a submission the server holds returns the original receipt and clears the record. Once per submission while this screen lives.
  const replayed = useRef(new Set<string>());
  useEffect(() => {
    const pending = proofReady?.pending;
    if (!proof || !pending || proofReady.busy || replayed.current.has(pending.submissionId)) return;
    if (![detail, ...(list?.items ?? [])].some(item => item && heldByServer(item, proofState))) return;
    replayed.current.add(pending.submissionId); void proof.recover();
  }, [proofReady, detail, list]);
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
  if (available && route === 'proof' && detail && proof) return <ProofScreen key={detail.id} oath={detail} controller={proof} clock={controller.clock} backLabel={t('proof.back')}
    onBack={() => { void openDetail(detail.id); }} onDone={showReceipt} />;
  if (available && route === 'create') return <OathScreen approach={approach?.place === 'hearth' ? approach.id : null} controller={controller} timezone={timezone} rulesGuideStorage={rulesGuideStorage} onViewOath={id => { void openDetail(id); }} initialDraft={creationDraft} onDraftChange={setCreationDraft} backLabel={forgeNavigation ? returnLabel : undefined} backPlain={!!forgeNavigation && !interactiveForge} onBack={forgeNavigation ? () => forgeNavigation.onReturn('hearth') : () => { void loadList('today'); }} />;
  // In the room layout every list leaves a band under the tabs (Today's hub, the chronicle band). The close-up is lowered into it.
  // The detail has no title or tabs, so its close-up rises and the emblem meets the plinth higher, which keeps the card's action on screen (MVP-22-T09c).
  // While a hearth request waits for Today, only the hearth shows at the creation screen's framing. Creation or the list with its notice follows.
  // The same surface stays mounted, so its close-ups are already decoded.
  const waiting = available && hearthRequest;
  // Today shows each Oath's interrupted upload under its card. Worked out once, so the next card knows whether a line sits above it.
  const uploads = route === 'list' && view === 'today' ? (list?.items ?? []).map(item => upload(item)) : [];
  // Each Today row's place on the four steps, for its pips, its short label and the amber corner badge.
  const rowPaths = new Map(route === 'list' && view === 'today' && list ? list.items.map(item => [item.id, oathPath(item, deviceProof(item, proofState, subject), list.paused, controller.clock.now())] as const) : []);
  const interruptedIds = new Set([...rowPaths].flatMap(([oathId, path]) => path.badge === 'interrupted' ? [oathId] : []));
  // A row offering "Wyślij ponownie" holds the screen's only filled button, so the list's own actions step back to outline (clarity.md rule 3).
  const resendShown = !!proof && route === 'list' && view === 'today' && !!list?.items.some(item => deviceProof(item, proofState, subject) === 'waiting');
  const listAction = resendShown ? 'secondary' : 'primary';
  // Without the lowered close-up behind it, or wherever the artwork starts under it, the header stands on a solid band so its text never sits on the art.
  const solidHeader = !interactiveForge || route === 'detail';
  return <SceneSurface place={place} drop={interactiveForge && !waiting ? route === 'detail' ? DETAIL_DROP : LIST_DROP : 0} scroll={scroll} approach={approach && approach.place === place && place !== 'hearth' ? approach.id : null}>{waiting ? <SafeAreaView testID="hearth-waiting" style={styles.safeArea}><View style={styles.content}>
    {forgeNavigation && <View testID="screen-header" style={[styles.header, !interactiveForge && styles.solidHeader]}>{interactiveForge
      ? <SceneDoor label={returnLabel} onPress={() => forgeNavigation.onReturn('hearth')} />
      : <BackLink label={returnLabel} onPress={() => forgeNavigation.onReturn('hearth')} />}</View>}
    <SlowNotice text={t('oathHome.loading')} />
  </View></SafeAreaView> : <SafeAreaView style={styles.safeArea}><Animated.ScrollView testID="oath-list-scroll" style={entrance} key={scrollKey} contentOffset={restoredAt} contentContainerStyle={styles.content}
    refreshControl={available && route === 'list' ? <RefreshControl refreshing={pulling} onRefresh={() => pull()} tintColor={tokens.color.primary} /> : undefined} scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], { useNativeDriver: true, listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = event.nativeEvent.contentOffset.y; } })}>
    {/* The detail shows no screen title and no tabs, so its line and action stay above the fold (docs/product/clarity.md rule 1, MVP-22-T09c). */}
    {/* Its back control returns to the list it came from under that tab's name (MVP-22-T09e). The list's own goes to the room or the menu. */}
    <View testID="screen-header" style={[styles.header, solidHeader && styles.solidHeader]}>
      {/* The band ends in a short fade, so the artwork under it never starts on a hard edge (native check, MVP-22-T09e). */}
      {solidHeader && <View testID="header-fade" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headerFade} />}
      {route === 'detail'
        ? interactiveForge ? <SceneDoor label={t(`oathHome.${detailFrom}`)} hint={t('oathHome.backHint')} onPress={returnToList} /> : <BackLink label={t(`oathHome.${detailFrom}`)} hint={t('oathHome.backHint')} onPress={returnToList} />
        : forgeNavigation && (interactiveForge
          ? <SceneDoor label={returnLabel} onPress={() => forgeNavigation.onReturn(place)} />
          : <BackLink label={returnLabel} onPress={() => forgeNavigation.onReturn(place)} />)}
      {route !== 'detail' && <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t(view === 'today' ? 'forge.title' : 'oathHome.history')}</Text>}
      {available && route !== 'detail' && <View style={[styles.navigation, !interactiveForge && styles.stackedNavigation]}>{(['today', 'history'] as const).map(destination => <Pressable key={destination}
        accessibilityRole="button" accessibilityLabel={t(`oathHome.${destination}`)} accessibilityState={{ selected: route === 'list' && view === destination }}
        onPress={() => { void loadList(destination); }} style={[styles.tab, !interactiveForge && styles.stackedTab, route === 'list' && view === destination && styles.selectedTab]}>
        {/* Tabs are sans functional text, capped because the MVP-05 native check saw them break mid-word at the maximum size. */}
        <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.label}>{t(`oathHome.${destination}`)}</Text>
      </Pressable>)}</View>}
    </View>
    {!available && <>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{t(account.kind === 'storage_unavailable' ? 'oath.storageError' : 'oathHome.loading')}</Text>
      {account.kind === 'storage_unavailable' && <Action label={t('oath.retry')} onPress={() => { void controller.refresh(); }} />}
    </>}
    {available && <>
      {/* A fact, so a plain card line. Żaromir stays silent while paused (clarity.md decisions 5 and 14). */}
      {route === 'list' && list?.paused && <View testID="pause-note" accessibilityLiveRegion="polite" style={styles.note}><Text style={styles.noteText}>{t('oathHome.paused')}</Text></View>}
      {route === 'list' && busyNotice && <View accessibilityLiveRegion="polite"><CompanionBubble message={t('forge.busy')} /></View>}
      {/* The lowered chronicle close-up shows its book in this band, so no text crosses it. */}
      {route === 'list' && view === 'history' && interactiveForge && <View testID="chronicle-band" style={styles.chronicleBand} />}
      {route === 'list' && view === 'today' && <>
        <ForgeHub items={list?.items ?? []} clock={controller.clock} onElapsed={elapsed} onOpen={openFromList} interrupted={interruptedIds} onCreate={account.pending || list?.paused ? undefined : () => create()} createDisabled={account.busy} />
      </>}
      {route === 'list' && (account.pending ? <>
        <CompanionBubble message={t('oath.pending')} />
        <Action label={t('oath.recover')} variant={listAction} busy={account.busy} onPress={() => create(true)} />
      </> : !list?.paused && (view !== 'today' || !interactiveForge) && <Action label={t('oathHome.create')} variant={listAction} busy={account.busy} onPress={() => create()} />)}
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
        {/* Cards of one heading stand close together. A new heading or an upload line under the previous card opens a section's space. */}
        {list && !!list.items.length && <View testID="oath-entries">{list.items.map((item, index) => {
          const previous = list.items[index - 1];
          const newCategory = view === 'today' && (index === 0 || category(item) !== category(previous));
          const newGroup = view === 'today' && (newCategory || group(item) !== group(previous));
          const spaced = index > 0 && (view !== 'today' || newGroup || !!uploads[index - 1]);
          return <View key={item.id} testID={`oath-entry-${item.id}`} style={[styles.entry, index > 0 && { marginTop: spaced ? tokens.space.section : tokens.space.item }]}>
            {newCategory && <Text accessibilityRole="header" style={styles.label}>{t(`oathHome.${category(item)}`)}</Text>}
            {newGroup && <Text accessibilityRole="header" style={styles.group}>{group(item)}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel={summary(item)} accessibilityValue={{ text: t(`oath.states.${item.state}`) }} onPress={() => openFromList(item.id)}
              style={({ pressed }) => [styles.journalEntry, !interactiveForge && styles.stackedEntry, pressed && styles.pressedEntry]}>
              <View style={styles.emblems}>
                <ActivityEmblem activity={item.snapshot.activity} size={76} />
                <View style={styles.stateBadge}><StateSeal state={item.state} size={36} /></View>
                {interruptedIds.has(item.id) && <StepBadge badge="interrupted" size={32} testID="row-badge-interrupted" style={styles.interruptedBadge} />}
              </View>
              <View style={styles.entryCopy}>
                <Text style={styles.activity}>{item.snapshot.copy[locale].activity}</Text>
                {/* Today rows: four pips with the short state label, no full track (clarity.md decision 9). */}
                {view === 'today' && rowPaths.has(item.id) && <StepTrack variant="compact" path={rowPaths.get(item.id)!} state={item.state} />}
                {/* History rows show the result seal, the short visible state and when it closed, in the Oath's own zone (decision 10). */}
                <Text style={styles.deadline}>{view === 'history' ? `${t(`forge.sealState.${item.state}`)} · ${compactStoredTime(item.terminalAt ? wallTimeIn(item.terminalAt, item.snapshot.deadline.timezone) : item.snapshot.deadline.local, locale)}` : shortStoredTime(item.snapshot.deadline.local, locale, false)}</Text>
                {view === 'today' && <CountdownChip oath={item} clock={controller.clock} onElapsed={elapsed} />}
              </View>
            </Pressable>
            {uploads[index]}
          </View>;
        })}</View>}
        {/* Żaromir does not suggest a workout while paused (clarity.md rule 8). The pause note above says what holds. */}
        {!loading && !failed && list?.items.length === 0 && view === 'today' && !list.paused && <CompanionBubble message={t('oathHome.emptyToday')} />}
        {failed && <><View accessibilityLiveRegion="polite"><CompanionBubble message={t('oathHome.loadError')} /></View><Action label={t('oath.retry')} onPress={() => { void loadList(view, !!list?.nextCursor); }} /></>}
        {list?.nextCursor && !failed && <Action label={t('oathHome.more')} variant={listAction} busy={loading} onPress={() => { void loadList(view, true); }} />}
      </>}
      {route === 'detail' && <>
        {failed && <><CompanionBubble message={t('oathHome.detailError')} /><Action label={t('oath.retry')} onPress={() => { void openDetail(detailId.current, detailFrom, leftAt.current?.view === detailFrom ? leftAt.current.y : undefined); }} /></>}
        {detail && <>
          {/* In the room layout the emblem stands on the middle plinth of the seal wall, the text starts on the floor below it. */}
          <View testID={interactiveForge ? 'detail-wall' : undefined} style={[styles.detailHero, interactiveForge && styles.detailWall]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityEmblem activity={detail.snapshot.activity} size={108} /></View>
          <View style={styles.detailHead}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.detailTitle}>{detail.snapshot.copy[locale].title}</Text>
            <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.detailActivity}>{detail.snapshot.copy[locale].activity}</Text>
          </View>
          {detailPath(detail)}
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
  header: { gap: tokens.space.section },
  // Full bleed from the screen's top edge. Canvas, not a scrim, because the busiest part of every close-up sits right under it.
  solidHeader: { marginHorizontal: -tokens.space.card, marginTop: -24, paddingHorizontal: tokens.space.card, paddingTop: 24, paddingBottom: tokens.space.small, backgroundColor: tokens.color.canvas },
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
  deadline: { color: '#ded1bd', fontSize: 14, lineHeight: 22 },
  detailHero: { alignItems: 'center', paddingTop: 4 },
  // With DETAIL_DROP the emblem's foot lands on the middle plinth 252 pt below the surface top: 24 + 64 door + 8 + 24 gap + 132.
  detailWall: { height: 132, justifyContent: 'flex-end', paddingTop: 0 },
  chronicleBand: { height: 262 },
  detailHead: { alignItems: 'center', gap: 4, marginTop: -8 },
  detailTitle: { color: '#f3dfbd', fontFamily: tokens.font.display, fontSize: tokens.title, lineHeight: 36, textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  detailActivity: { color: tokens.color.primary, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 2.4, textTransform: 'uppercase', textAlign: 'center' },
  facts: { gap: 10 },
  statusTime: { color: '#ded1bd', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  statusReason: { color: tokens.color.secondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  upload: { gap: 10 },
  uploadText: { color: tokens.color.text, fontSize: 15, lineHeight: 22 },
  emblems: { width: 84, height: 84 },
  stateBadge: { position: 'absolute', right: -6, bottom: -6 },
  // The amber badge of an interrupted upload takes the opposite corner from the state seal.
  interruptedBadge: { position: 'absolute', left: -6, top: -6 },
  note: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#5b4630', backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  noteText: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  // About 24 pt from the band's own colour to clear, hanging under it.
  headerFade: { position: 'absolute', left: 0, right: 0, top: '100%', height: 24, experimental_backgroundImage: `linear-gradient(180deg, ${tokens.color.canvas} 0%, rgba(20, 23, 25, 0) 100%)` },
  parchment: { backgroundColor: 'rgba(27, 24, 20, 0.95)', padding: 18, borderTopWidth: 2, borderTopColor: '#9d7b4d', borderBottomWidth: 2, borderBottomColor: '#5d452c', borderRadius: 5 },
  navigation: { flexDirection: 'row', gap: 24, backgroundColor: 'rgba(17, 19, 21, 0.5)', borderRadius: 8 }, stackedNavigation: { flexDirection: 'column', gap: 8 }, stackedTab: { flex: 0, alignItems: 'flex-start' },
  tab: { flex: 1, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#5d4e39' },
  selectedTab: { borderBottomColor: '#f3bc72', backgroundColor: 'rgba(127, 87, 41, 0.18)' },
  title: { color: '#f3dfbd', fontSize: 28, fontFamily: tokens.font.display, fontWeight: '400', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 }, label: { color: tokens.color.text, fontSize: tokens.body, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }, body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
