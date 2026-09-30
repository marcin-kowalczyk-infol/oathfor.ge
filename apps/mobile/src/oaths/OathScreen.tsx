import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Image, Pressable, SafeAreaView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { isPreviewInput, type Activity, type LocalTimeInput, type PreviewInput } from '../api/oathSchema';
import { Action } from '../ui/Action';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import { GameChoice } from '../ui/GameChoice';
import { tokens } from '../ui/tokens';
import { SceneSurface } from '../ui/SceneSurface';
import { CompanionBubble } from '../ui/CompanionBubble';
import { SceneDoor } from '../ui/SceneDoor';
import { BackLink } from '../ui/BackLink';
import { ActivityOffering } from './ActivityOffering';
import { SealStamp } from './SealStamp';
import { CountdownChip } from './CountdownChip';
import { countdownTarget, formatCountdown } from './countdown';
import { shortStoredTime } from './compactStoredTime';
import { zoneLabel } from './zoneLabel';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { resolveLocale } from '../localization/locale';
import { SnapshotRules } from './SnapshotRules';
import { OathRuleCards } from './OathRuleCards';
import type { RuleCardId } from './ruleCards';
import { DialoguePanel } from '../forge/DialoguePanel';
import type { GuideStorage } from '../forge/guideStorage';
import { bindShortWords } from '../localization/typography';
import { layoutMode } from '../ui/layoutMode';
import { useMotionAllowed } from '../ui/useMotion';
import type { OathController } from './controller';
import { WallTimePicker, type TimeDraft } from './WallTimePicker';
import { useArt } from '../art/ArtProvider';
// Żaromir's four lines on the first review (docs/product/oath-screens.md section 2) and the card each one lights.
const GUIDE_CARDS: (RuleCardId | null)[] = [null, 'deadline', 'cutoff', 'fixed'];
// The named card stops a little below the top edge, so its gold border stays in view.
const GUIDE_MARGIN = 12;
// Oaths whose seal was stamped in this app run. A remount or a replayed confirmation shows the sealed scroll without stamping again.
const stamped = new Set<string>();
export type OathCreationDraft = { activity: Activity; scheduled: boolean; activation: TimeDraft; deadline: TimeDraft };
function emptyDraft(timezone: string): OathCreationDraft {
  return { activity: 'running', scheduled: false, activation: { date: '', time: '', zone: timezone }, deadline: { date: '', time: '', zone: timezone } };
}
export function OathScreen({ controller, timezone, onBack, backLabel, backPlain = false, initialDraft, onDraftChange, approach = null, onViewOath, rulesGuideStorage }: { controller: OathController; timezone: string; onBack?(): void; backLabel?: string; /** Simple layout: a plain back control instead of the room door picture. */ backPlain?: boolean; initialDraft?: OathCreationDraft | null; onDraftChange?(draft: OathCreationDraft | null): void; approach?: number | null; /** Opens the detail of a just made Oath. */ onViewOath?(id: string): void; /** The "seen" flag of Żaromir's rules explanation, per account on this device (owner decision Q4). */ rulesGuideStorage?: GuideStorage }) {
  const zharomir = useArt().zharomirBust;
  const { t, i18n } = useTranslation();
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
  // A confirmed Oath shows its detail in the same render, so no frame falls back to the creation form (native check, 2026-09-30).
  const [shownOath, setShownOath] = useState<typeof oath>(undefined);
  if (oath !== shownOath) { setShownOath(oath); if (oath) setMode('detail'); }
  useEffect(() => { if (oath) onDraftChange?.(null); }, [oath, onDraftChange]);
  const local = (draft: TimeDraft): LocalTimeInput => ({ local: `${draft.date}T${draft.time}`, timezone: draft.zone, ...(draft.offset ? { offset: draft.offset } : {}) });
  const input: PreviewInput = { activity, activation: scheduled ? { mode: 'scheduled', time: local(activation) } : { mode: 'now' }, deadline: local(deadline) };
  const valid = isPreviewInput(input);
  const error = ready?.error;
  const choices = submitted && error?.kind === 'time_error' && error.code === 'ambiguous_local_time' ? error : undefined;
  const detail = oath && mode === 'detail';
  const review = !detail && ready?.preview && (mode === 'review' || !!pending);
  const scene = `${detail ? 'detail' : pending ? 'pending' : review ? 'review' : 'form'}-${error?.kind ?? ''}-${error && 'code' in error ? error.code : ''}`;
  const entrance = useSceneEntrance(scene);
  const scroll = useRef(new Animated.Value(0)).current;
  useEffect(() => { scroll.setValue(0); }, [scene, scroll]);
  const window = useWindowDimensions();
  const [, setSealed] = useState<string | null>(null);
  // The stamp and the sealed scroll share one size, so the scroll does not jump when the press ends (native check, 2026-09-30).
  const scrollWidth = Math.min(260, window.width - 48);
  const motion = useMotionAllowed() && layoutMode(window.width, window.fontScale) === 'room';
  // The same threshold as the activity offerings, so the default text size keeps its rows on every width.
  const largeText = window.fontScale > 1.3;
  const accountId = rulesGuideStorage ? controller.boundCharacter()?.accountId : undefined;
  const reviewing = !!review && !pending;
  // Unknown until read. A pending read shows nothing, a failed read counts as unseen: showing the lines again is the safe loss.
  const [guideSeen, setGuideSeen] = useState<boolean | null>(null);
  const [guideLine, setGuideLine] = useState<number | null>(null);
  const scrollView = useRef<{ scrollTo(options: { y: number; animated?: boolean }): void } | null>(null);
  // Native check, 2026-09-30: in one column the named cards sit far below the grid top. The measured places are state,
  // so a card measured after its step began still moves the page.
  const [guideTops, setGuideTops] = useState<{ block: number; grid: number; cards: Partial<Record<RuleCardId, number>> }>({ block: 0, grid: 0, cards: {} });
  useEffect(() => {
    if (!reviewing || !rulesGuideStorage || !accountId || guideSeen !== null) return;
    let live = true;
    const settle = (seen: boolean) => { if (!live) return; setGuideSeen(seen); if (!seen) setGuideLine(0); };
    rulesGuideStorage.read(accountId).then(settle, () => settle(false));
    return () => { live = false; };
  }, [reviewing, rulesGuideStorage, accountId, guideSeen]);
  function closeGuide() {
    setGuideLine(null);
    if (guideSeen === false && accountId) { setGuideSeen(true); void rulesGuideStorage?.markSeen(accountId); }
  }
  const guideShown = reviewing && guideLine !== null;
  // Each step brings the card Żaromir names into view above the panel. His opening line shows the grid top.
  const guideCard = guideShown ? GUIDE_CARDS[guideLine!] : null;
  // The last step closes the guide, so it offers a finishing word instead of "Next" (native check, 2026-09-30).
  const guideStep = t(guideLine === GUIDE_CARDS.length - 1 ? 'room.tutorial.finish' : 'room.tutorial.next');
  const guideTop = guideShown ? Math.max(0, guideTops.block + guideTops.grid + (guideCard ? guideTops.cards[guideCard] ?? 0 : 0) - GUIDE_MARGIN) : null;
  useEffect(() => { if (guideTop !== null) scrollView.current?.scrollTo({ y: guideTop, animated: motion }); }, [guideTop, guideLine, motion]);
  // Native check, 2026-09-30: at the largest text size the 280 pt panel cut the fourth line of the first Polish guide line.
  // The line is capped at 2x, 46 pt a line, and the longest Polish and English lines wrap to four lines at 375 and 402 pt.
  // The frame and the step row take 114 pt, so 344 pt holds five lines and leaves the upper half of the screen for the card.
  const guideFrame = { left: 12, width: Math.min(window.width - 24, 560), bottom: 24, maxHeight: largeText ? Math.min(344, window.height * 0.5) : Math.min(280, window.height * 0.45) };
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  // VoiceOver hears once that the Oath was made and how long is left, when the stamp settles.
  function announceMade(made: NonNullable<typeof oath>) {
    const target = countdownTarget(made); const now = controller.clock.now();
    const left = target && now !== null ? `${t(`countdown.${target.kind}`)} ${formatCountdown(target.at - now, t, target.kind === 'start' ? 'accusative' : 'nominative').spoken}` : '';
    AccessibilityInfo.announceForAccessibility(left ? `${t('oath.made')}. ${left}` : t('oath.made'));
  }
  async function preview() {
    if (!valid || busy || pending) return;
    setSubmitted(true); await controller.preview(input);
    const next = controller.getState();
    if (next.kind === 'ready' && next.preview) setMode('review');
  }
  function timeFields(field: 'activation' | 'deadline', draft: TimeDraft, setDraft: (value: TimeDraft) => void) {
    const occurrence = choices?.field === field ? choices : undefined;
    return <View style={styles.group}>
      <WallTimePicker field={field} value={draft} disabled={busy} now={() => controller.clock.now() ?? Date.now()} onChange={value => { if (!busy) { setDraft(value); setSubmitted(false); } }} />
      {occurrence && <View style={styles.group}>
        {/* Native check, 2026-09-30: inside the 350 / 323 pt bench the uncapped "dwukrotnie." and "wystąpienie" take about 367 pt. */}
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{t('oath.offsetChoice', { field: t(`oath.${field}Time`) })}</Text>
        {occurrence.validOffsets?.map(offset => <Pressable key={offset} accessibilityRole="radio"
          accessibilityLabel={t('oath.occurrence', { offset })} accessibilityState={{ selected: draft.offset === offset, disabled: busy }} disabled={busy}
          style={[styles.choice, draft.offset === offset && styles.selected]} onPress={() => { if (!busy) setDraft({ ...draft, offset }); }}>
          <Text style={styles.body}>{t('oath.occurrence', { offset })}</Text>
        </Pressable>)}
      </View>}
    </View>;
  }
  // Native check, 2026-09-30: uncapped at the largest size the pending, storage and error lines hold words wider than the
  // 370 pt column ("kontynuowaniem." and "potwierdzeniem." about 501 pt, "potwierdzenie" 434 pt), so they take the display cap.
  // Lines whose words fit stay uncapped as tokens.ts asks, and the consent inside its frame takes the inset cap.
  let errorText: string | undefined;
  if (error) {
    if (error.kind === 'storage') errorText = t('oath.storageError');
    else if (error.kind === 'time_error' || error.kind === 'oath_error') errorText = t(`oath.error.${error.code}`, { defaultValue: t('oath.error.generic') });
    else errorText = t(error.kind === 'invalid_request' ? 'oath.error.invalid_request' : 'oath.error.generic');
  }
  return <SceneSurface place="hearth" approach={approach} scroll={scroll}><SafeAreaView style={styles.safeArea}>
    <Animated.ScrollView ref={scrollView as never} style={entrance} key={scene} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], { useNativeDriver: true })}>
      {onBack && (backPlain ? <BackLink label={backLabel ?? t('oathHome.today')} onPress={onBack} /> : <SceneDoor label={backLabel ?? t('oathHome.today')} onPress={onBack} />)}
      {!review && !detail && <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('oath.title')}</Text>}
      {!ready && <>
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{t(state.kind === 'storage_unavailable' ? 'oath.storageError' : 'oath.loading')}</Text>
        {state.kind === 'storage_unavailable' && <Action label={t('oath.retry')} onPress={() => { void controller.refresh(); }} />}
      </>}
      {ready && errorText && <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{errorText}</Text>}
      {ready?.needsReview && <Text style={styles.body}>{t('oath.reviewAgain')}</Text>}
      {pending && <>
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{t('oath.pending')}</Text>
        <Action label={t('oath.recover')} busy={busy} onPress={() => { void controller.recover(); }} />
      </>}
      {detail && <>
        <View style={styles.confirmed}>
          <SealStamp width={scrollWidth} sealed={stamped.has(oath.id)} onDone={() => { stamped.add(oath.id); setSealed(oath.id); announceMade(oath); }} />
          {stamped.has(oath.id) && <>
          <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityEmblem activity={oath.snapshot.activity} size={56} /></View>
          <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('oath.made')}</Text>
          <CountdownChip oath={oath} clock={controller.clock} size="large" />
          <Text style={styles.body}>{t('oath.madeDeadline', { time: `${shortStoredTime(oath.snapshot.deadline.local, locale, true)} · ${zoneLabel(oath.snapshot.deadline.timezone, t)}` })}</Text>
          <Text style={styles.body}>{t('oath.state', { state: t(`oath.states.${oath.state}`) })}</Text>
          </>}
        </View>
        {stamped.has(oath.id) && onViewOath && <Action label={t('oath.viewOath')} onPress={() => onViewOath(oath.id)} />}
        {stamped.has(oath.id) && onBack && <Action label={backLabel ?? t('oathHome.today')} variant="secondary" onPress={onBack} />}
        {stamped.has(oath.id) && !pending && <Action label={t('oath.newOath')} variant="secondary" onPress={() => { if (controller.resetCreation()) { const next = emptyDraft(timezone); setDraft(next); onDraftChange?.(null); setMode('form'); setSubmitted(false); } }} />}
      </>}
      {review && <>
        <CompanionBubble message={t('oath.reviewIntro')} />
        {rulesGuideStorage && guideSeen !== null && !guideShown && <Pressable accessibilityRole="button" accessibilityLabel={t('oath.guide.replay')} onPress={() => setGuideLine(0)} style={({ pressed }) => [styles.replay, pressed && styles.pressed]}>
          <View style={styles.replayBust}><Image source={zharomir} resizeMode="cover" style={styles.replayImage} /></View>
          <Text accessible={false} maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.replayText}>{t('oath.guide.replay')}</Text>
        </Pressable>}
        <View testID="oath-rules-block" onLayout={event => { const y = event.nativeEvent.layout.y; setGuideTops(tops => tops.block === y ? tops : { ...tops, block: y }); }}>
          <OathRuleCards snapshot={ready.preview!.snapshot} highlight={guideCard} onCardsLayout={y => setGuideTops(tops => tops.grid === y ? tops : { ...tops, grid: y })}
            onCardLayout={(id, y) => setGuideTops(tops => tops.cards[id] === y ? tops : { ...tops, cards: { ...tops.cards, [id]: y } })} />
        </View>
        {guideShown && <View style={{ height: 240 }} />}
        {!pending && <>
          <View style={styles.consent}><Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.body}>{t('oath.consent')}</Text></View>
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
        {/* Native check, 2026-09-30: at the largest text size "W przyszłym terminie" broke mid-word between the medallion and the marker.
            The start labels take the full width under them, and the bench gives back some side padding. */}
        <View style={[styles.timeWorkbench, largeText && styles.wideBench]}>
          <Text accessibilityRole="header" style={styles.label}>{t('oath.startChoice')}</Text>
          {[false, true].map(value => <GameChoice key={String(value)} label={t(value ? 'oath.scheduled' : 'oath.now')} symbol={value ? '◷' : 'ϟ'} stacked={largeText}
            selected={scheduled === value} disabled={busy} onPress={() => { setScheduled(value); setSubmitted(false); }} />)}
          {scheduled && timeFields('activation', activation, setActivation)}
          {timeFields('deadline', deadline, setDeadline)}
        </View>
        <Action label={t('oath.viewRules')} busy={busy} onPress={() => { void preview(); }}
          {...(!valid || (!!choices && !(choices.field === 'activation' ? activation.offset : deadline.offset))
            ? { disabled: true, unavailableReason: !valid ? t('oath.formRequired') : t('oath.error.ambiguous_local_time') } : { disabled: false })} />
      </>}
    </Animated.ScrollView>
    {guideShown && <DialoguePanel frame={guideFrame}
      speaker="guide" lineId={`rules-${guideLine}`} text={bindShortWords(t(`oath.guide.${guideLine! + 1}`), i18n.language)} playerName="" portrait={null} allowed={motion} more={guideLine! < 3}
      continueLabel={guideStep} onContinue={() => guideLine! < 3 ? setGuideLine(guideLine! + 1) : closeGuide()}
      controls={{ step: { count: `${guideLine! + 1} / ${GUIDE_CARDS.length}`, label: guideStep, text: true, onPress: () => guideLine! < 3 ? setGuideLine(guideLine! + 1) : closeGuide() } }}
      dismissLabel={t('room.guide.skip')} onDismiss={closeGuide} />}
  </SafeAreaView></SceneSurface>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: tokens.space.card, paddingBottom: 36, gap: tokens.space.section },
  workbench: { gap: 14 }, offerings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' },
  timeWorkbench: { padding: 18, gap: 18, backgroundColor: 'rgba(28, 24, 20, 0.92)', borderRadius: 24 }, wideBench: { paddingHorizontal: 10 },
  confirmed: { gap: 14, alignItems: 'center', paddingVertical: 24 },
  consent: { padding: 20, borderLeftWidth: 3, borderLeftColor: tokens.color.primary, backgroundColor: 'rgba(32, 25, 19, 0.94)', borderRadius: 12 },
  group: { gap: tokens.space.item },
  title: { color: tokens.color.text, fontFamily: tokens.font.display, fontSize: tokens.title, lineHeight: tokens.title * 1.3, fontWeight: '400' },
  label: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  choice: { minHeight: 64, padding: 18, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius },
  selected: { backgroundColor: '#493821', borderColor: tokens.color.primary },
  // Native check, 2026-09-30: the pill sized itself to the unshrunk label, 44 + 10 + about 370 + 14 pt, and ran past the screen edge.
  // The column bounds it and the label shrinks and wraps inside.
  replay: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 10, minHeight: 44, paddingRight: 14, borderRadius: 22, backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  replayBust: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#b58a52' },
  replayImage: { width: 44, height: 44 },
  replayText: { flexShrink: 1, color: tokens.color.text, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
