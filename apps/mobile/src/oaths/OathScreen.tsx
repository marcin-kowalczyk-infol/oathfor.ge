import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { isPreviewInput, localInput, type Activity, type LocalTimeInput, type PreviewInput } from '../api/oathSchema';
import { Action } from '../ui/Action';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import { GameChoice } from '../ui/GameChoice';
import { tokens } from '../ui/tokens';
import { SceneSurface } from '../ui/SceneSurface';
import { SceneDoor } from '../ui/SceneDoor';
import { FadeStrips } from '../ui/FadeStrips';
import { BackLink } from '../ui/BackLink';
import { Disclosure } from '../ui/Disclosure';
import { ActivityOffering } from './ActivityOffering';
import { SealStamp } from './SealStamp';
import { CountdownChip } from './CountdownChip';
import { countdownTarget, formatCountdown } from './countdown';
import { pathTimeText } from './compactStoredTime';
import { oathPath } from './oathPath';
import { StepTrack } from '../ui/StepTrack';
import { ZaromirLine } from '../ui/ZaromirLine';
import { zaromirSeed } from '../companion/zaromirLine';
import { zoneLabel } from './zoneLabel';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { resolveLocale } from '../localization/locale';
import { SnapshotRules } from './SnapshotRules';
import { ReviewFold, ReviewRules } from './ReviewRules';
import type { PictogramId } from './ruleCards';
import { HoldSeal } from '../ui/HoldSeal';
import { DialoguePanel, PANEL_RISE } from '../forge/DialoguePanel';
import type { GuideStorage } from '../forge/guideStorage';
import { bindShortWords } from '../localization/typography';
import { layoutMode } from '../ui/layoutMode';
import { useMotionAllowed } from '../ui/useMotion';
import type { OathController } from './controller';
import { WallTimePicker, type TimeDraft } from './WallTimePicker';
import { useArt } from '../art/ArtProvider';
// Żaromir's barks on the first review, one per large pictogram, which lights and plays its gesture (engagement.md E3, MVP-22-E3.3).
const GUIDE_CARDS: PictogramId[] = ['deadline', 'cutoff', 'fixed'];
const LAST_GUIDE_LINE = GUIDE_CARDS.length - 1;
// The named pictogram stops a little below the top edge, so its gold border stays in view.
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
  const forming = !!ready && !pending && !review && !detail;
  const titled = !review && !detail;
  // The form has no intro line since MVP-22-E1.4: its disabled "Zobacz zasady" names what is missing (word budget).
  // The review has none since MVP-22-E3.2: the hold seal's drawn consent names the next step (engagement.md E3).
  // A screen change remounts the scroll view, so it opens at its heading with a short entrance. MVP-22 G31: an error on the
  // same screen does not remount it, because a retry would replay the entrance and lose the VoiceOver focus on the pressed control.
  const scene = detail ? 'detail' : pending ? 'pending' : review ? 'review' : 'form';
  const entrance = useSceneEntrance(scene);
  const scroll = useRef(new Animated.Value(0)).current;
  useEffect(() => { scroll.setValue(0); }, [scene, scroll]);
  // The busy publish of a retry clears the error for a moment. The notice holds the last error through it, so only a new error counts.
  const errorKey = error ? `${error.kind}-${'code' in error ? error.code : ''}` : '';
  const [notice, setNotice] = useState(errorKey);
  if (errorKey !== notice && (errorKey !== '' || !busy)) setNotice(errorKey);
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
  // A new error brings the band with its line back to the top, as a screen change does (native check, 2026-09-25), without a remount.
  // A cleared error leaves the page where it is.
  useEffect(() => { if (notice) { scrollView.current?.scrollTo({ y: 0, animated: false }); scroll.setValue(0); } }, [notice, scroll]);
  // Native check, 2026-09-30: in one column the named cards sit far below the grid top. The measured places are state,
  // so a card measured after its step began still moves the page.
  const [guideTops, setGuideTops] = useState<{ block: number; grid: number; cards: Partial<Record<PictogramId, number>> }>({ block: 0, grid: 0, cards: {} });
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
  // Each step brings the pictogram Żaromir names into view above the panel.
  const guideCard = guideShown ? GUIDE_CARDS[guideLine!] : null;
  // The last step closes the guide, so it offers a finishing word instead of "Next" (native check, 2026-09-30).
  const guideStep = t(guideLine === LAST_GUIDE_LINE ? 'room.tutorial.finish' : 'room.tutorial.next');
  // Native check, 2026-10-02 (MVP-22-E3r): the hold seal block crossed the bottom edge under Żaromir's bust. A block that
  // crosses the edge moves the page down by its overshoot, at most until the named card's top meets the screen top.
  const [viewport, setViewport] = useState(0);
  const [hold, setHold] = useState<{ y: number; height: number } | null>(null);
  const cardTop = guideTops.block + guideTops.grid + (guideCard ? guideTops.cards[guideCard] ?? 0 : 0);
  const stepTop = Math.max(0, cardTop - GUIDE_MARGIN);
  const holdOvershoot = hold && viewport > 0 && hold.y - stepTop < viewport ? hold.y + hold.height - stepTop - viewport : 0;
  const guideTop = guideShown ? Math.min(stepTop + Math.max(0, holdOvershoot), Math.max(stepTop, cardTop)) : null;
  // Native check, 2026-09-30: at the largest text size the 280 pt panel cut the fourth line of the first Polish guide line.
  // The line is capped at 2x, 46 pt a line, and the longest Polish and English lines wrap to four lines at 375 and 402 pt.
  // The frame and the step row take 114 pt, so 344 pt holds five lines and leaves the upper half of the screen for the card.
  const guideFrame = { left: 12, width: Math.min(window.width - 24, 560), bottom: 24, maxHeight: largeText ? Math.min(344, window.height * 0.5) : Math.min(280, window.height * 0.45) };
  // MVP-22-B2 (G21), MVP-22-E3r: while the guide is open the scroll view ends above the panel, its bottom gap and the rising bust,
  // so neither covers the review and every card and the consent can scroll clear. Until the panel is measured its height limit stands in.
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const guideInset = guideShown ? (panelHeight ?? guideFrame.maxHeight) + guideFrame.bottom + PANEL_RISE : null;
  // The shorter scroll view lets the page move further, so the step scrolls again once the panel and the view are measured.
  useEffect(() => { if (guideTop !== null) scrollView.current?.scrollTo({ y: guideTop, animated: motion }); }, [guideTop, guideLine, motion, guideInset, viewport]);
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  // Drawn prose keeps Polish single-letter words with the next word and never ends a line on a separator (MVP-22-G24b).
  // Spoken labels, hints and button titles keep the plain form.
  const prose = (value: string) => bindShortWords(value, locale);
  // VoiceOver hears once that the Oath was made and how long is left, when the stamp settles.
  function announceMade(made: NonNullable<typeof oath>) {
    const target = countdownTarget(made); const now = controller.clock.now();
    const left = target && now !== null ? `${t(`countdown.${target.kind}`)} ${formatCountdown(target.at - now, t, target.kind === 'start' ? 'accusative' : 'nominative').spoken}` : '';
    AccessibilityInfo.announceForAccessibility(left ? `${t('oath.made')}. ${left}` : t('oath.made'));
  }
  // MVP-22-E1r2, native check 2026-10-02: the line names the first missing part. A chosen date without its time names the time,
  // because its row already shows the date. The start comes first, then the deadline (MVP-22-E1.R).
  function missingChoice() {
    if (scheduled && !localInput(local(activation))) return activation.date && !activation.time ? 'oath.formRequiredStartTime' : 'oath.formRequiredStart';
    return deadline.date && !deadline.time ? 'oath.formRequiredTime' : 'oath.formRequired';
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
      <WallTimePicker field={field} parts={['date', 'time']} value={draft} disabled={busy} now={() => controller.clock.now() ?? Date.now()} onChange={value => { if (!busy) { setDraft(value); setSubmitted(false); } }} />
      {occurrence && <View style={styles.group}>
        {/* Native check, 2026-09-30: inside the 350 / 323 pt bench the uncapped "dwukrotnie." and "wystąpienie" take about 367 pt. */}
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{prose(t('oath.offsetChoice', { field: t(`oath.${field}Time`) }))}</Text>
        {occurrence.validOffsets?.map(offset => <Pressable key={offset} accessibilityRole="radio"
          accessibilityLabel={t('oath.occurrence', { offset })} accessibilityState={{ selected: draft.offset === offset, disabled: busy }} disabled={busy}
          style={[styles.choice, draft.offset === offset && styles.selected]} onPress={() => { if (!busy) setDraft({ ...draft, offset }); }}>
          <Text style={styles.body}>{t('oath.occurrence', { offset })}</Text>
        </Pressable>)}
      </View>}
    </View>;
  }
  // MVP-22-E1.R: the zones fold under one link that names them, so the form stays within its word budget (clarity rule 2).
  // Each zone field inside keeps its whole name, start or deadline.
  function zoneFold() {
    const drafts = scheduled ? [['activation', activation, setActivation], ['deadline', deadline, setDeadline]] as const : [['deadline', deadline, setDeadline]] as const;
    const names = [...new Set(drafts.map(([, draft]) => zoneLabel(draft.zone, t)))];
    return <Disclosure label={t(names.length > 1 ? 'oath.zonesFold' : 'oath.zoneFold', { zones: names.join(', ') })}>
      {drafts.map(([field, draft, setDraft]) => <WallTimePicker key={field} field={field} parts={['zone']} value={draft} disabled={busy} now={() => controller.clock.now() ?? Date.now()}
        onChange={value => { if (!busy) { setDraft(value); setSubmitted(false); } }} />)}
    </Disclosure>;
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
  // MVP-22-G32: beside a confirmed detail the band names the made Oath in one line instead of the pending and storage lines.
  // After the player's own check an error replaces that line (clarity.md decision 3). While the check runs no line shows,
  // as the error line already does. Only a press on the detail counts, so the press that brought the detail keeps the line.
  const confirmedPending = !!detail && !!pending;
  const [checked, setChecked] = useState(false);
  if (checked && !confirmedPending) setChecked(false);
  const bandError = confirmedPending && !checked ? undefined : errorText;
  return <SceneSurface place="hearth" approach={approach} scroll={scroll}><SafeAreaView style={styles.safeArea}>
    <Animated.ScrollView testID="oath-scroll" ref={scrollView as never} style={[entrance, guideInset !== null && { marginBottom: guideInset }]} key={scene} contentContainerStyle={styles.content}
      onLayout={event => setViewport(event.nativeEvent.layout.height)} keyboardShouldPersistTaps="handled" scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], { useNativeDriver: true })}>
      {/* MVP-22-B2 (G16): the hearth close-up starts at the top, so the way back, the title, the line and the workout label
          stand on a solid band that fades into the art, as on the detail. Cards and offerings carry their own fills below it. */}
      {(onBack || titled || (ready && bandError) || ready?.needsReview || pending) && <View testID="screen-header" style={styles.band}>
        <FadeStrips testID="header-fade" stripTestID="header-fade-strip" style={styles.bandFade} />
        {onBack && (backPlain ? <BackLink label={backLabel ?? t('oathHome.today')} onPress={onBack} /> : <SceneDoor label={backLabel ?? t('oathHome.today')} onPress={onBack} />)}
        {titled && <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('oath.title')}</Text>}
        {/* MVP-22-B2c: the error and review-again lines stand above the workout header, so the header stays with its offerings. */}
        {ready && bandError && <Text budget="error" accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{prose(bandError)}</Text>}
        {ready?.needsReview && <Text style={styles.body}>{prose(t('oath.reviewAgain'))}</Text>}
        {/* MVP-22-G27: the pending line and its action stand on the band after the error line, never on the hearth fire. */}
        {pending && <>
          {!(confirmedPending && checked) && <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{prose(t(confirmedPending ? 'oath.pendingConfirmed' : 'oath.pending'))}</Text>}
          {/* MVP-22 G30: the server confirmed the Oath but clearing the device record failed, so the detail and this band show together.
              The detail's action stays the one filled action (clarity.md rule 3). The check steps to outline and stays, because the
              line asks for it and the record still blocks a new Oath. It replays the same identity, so it is harmless. */}
          <Action label={t('oath.recover')} busy={busy} variant={detail ? 'secondary' : 'primary'} onPress={() => { if (confirmedPending) setChecked(true); void controller.recover(); }} />
        </>}
        {forming && <Text accessibilityRole="header" style={styles.label}>{t('oath.activity')}</Text>}
      </View>}
      {!ready && <>
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.body}>{prose(t(state.kind === 'storage_unavailable' ? 'oath.storageError' : 'oath.loading'))}</Text>
        {state.kind === 'storage_unavailable' && <Action label={t('oath.retry')} onPress={() => { void controller.refresh(); }} />}
      </>}
      {detail && <>
        {/* After the stamp (clarity.md decision 13): emblem, header, the track with the Oath step done, the large countdown,
            one merged line with state, deadline and zone, Żaromir's line, then one filled action. The pause is unknown here,
            and a pause withdraws scheduled and active Oaths, so he speaks only for those two states. */}
        <View style={styles.confirmed}>
          <SealStamp width={scrollWidth} sealed={stamped.has(oath.id)} onDone={() => { stamped.add(oath.id); setSealed(oath.id); announceMade(oath); }} />
          {stamped.has(oath.id) && <>
          <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityEmblem activity={oath.snapshot.activity} size={56} /></View>
          <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('oath.made')}</Text>
          <View style={styles.track}><StepTrack path={oathPath(oath, 'none', null, controller.clock.now())} state={oath.state} activityEmblem={oath.snapshot.activity} /></View>
          <CountdownChip oath={oath} clock={controller.clock} size="large" />
          <Text style={[styles.body, styles.centred]}>{prose(t('oath.madeLine', { state: t(`oath.states.${oath.state}`), time: pathTimeText(oath.snapshot.deadline, locale), zone: zoneLabel(oath.snapshot.deadline.timezone, t) }))}</Text>
          </>}
        </View>
        {stamped.has(oath.id) && (() => {
          // A replayed acceptance can return an Oath that already moved on, so only a scheduled or active one hears the greeting (MVP-22-T12c).
          const situation = oath.state === 'scheduled' ? 'confirmedScheduled' : oath.state === 'active' ? 'confirmed' : null;
          return <ZaromirLine situation={situation} seed={situation ? zaromirSeed(oath.id, situation, controller.clock.now(), oath.snapshot.deadline.timezone) : ''} />;
        })()}
        {stamped.has(oath.id) && onViewOath && <Action label={t('oath.viewOath')} onPress={() => onViewOath(oath.id)} />}
        {stamped.has(oath.id) && onBack && <Action label={backLabel ?? t('oathHome.today')} variant="secondary" direction="back" onPress={onBack} />}
        {stamped.has(oath.id) && !pending && <Action label={t('oath.newOath')} variant="secondary" onPress={() => { if (controller.resetCreation()) { const next = emptyDraft(timezone); setDraft(next); onDraftChange?.(null); setMode('form'); setSubmitted(false); } }} />}
      </>}
      {review && <>
        {rulesGuideStorage && guideSeen !== null && !guideShown && <Pressable accessibilityRole="button" accessibilityLabel={t('oath.guide.replay')} onPress={() => setGuideLine(0)} style={({ pressed }) => [styles.replay, pressed && styles.pressed]}>
          <View style={styles.replayBust}><Image source={zharomir} resizeMode="cover" style={styles.replayImage} /></View>
          <Text accessible={false} maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.replayText}>{t('oath.guide.replay')}</Text>
        </Pressable>}
        <View testID="oath-rules-block" onLayout={event => { const y = event.nativeEvent.layout.y; setGuideTops(tops => tops.block === y ? tops : { ...tops, block: y }); }}>
          <ReviewRules snapshot={ready.preview!.snapshot} highlight={guideCard} gesture={motion} onRowLayout={y => setGuideTops(tops => tops.grid === y ? tops : { ...tops, grid: y })}
            onPictogramLayout={(id, y) => setGuideTops(tops => tops.cards[id] === y ? tops : { ...tops, cards: { ...tops.cards, [id]: y } })} />
        </View>
        {/* MVP-22-E3.2 (D-E1, D-E5): the hold seal is the one filled control. Its label is the stored declaration, its drawn hint
            is the consent. A full hold calls the idempotent confirm, and the stamping still waits for the server. */}
        {!pending && <View testID="oath-hold-block" onLayout={event => { const { y, height } = event.nativeEvent.layout; setHold(last => last?.y === y && last.height === height ? last : { y, height }); }}>
          <HoldSeal declaration={ready.preview!.snapshot.copy[locale].declaration} busy={busy} hint={t('oath.consent')} tapHint={t('oath.consentTap')}
            onSeal={() => { void controller.confirm(); }} />
        </View>}
        <ReviewFold snapshot={ready.preview!.snapshot} />
        {!pending && <Pressable accessibilityRole="button" accessibilityLabel={t('oath.edit')} accessibilityState={{ disabled: busy }} disabled={busy}
          onPress={() => { setMode('form'); setSubmitted(false); }} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
          <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.textActionLabel, busy && styles.muted]}>{t('oath.edit')}</Text>
        </Pressable>}
      </>}
      {forming && <>
        <View style={styles.workbench}>
          <View style={styles.offerings}>
            {(['running', 'strength_training', 'mobility'] as const).map(value => <ActivityOffering key={value} activity={value}
              label={t(`oath.activities.${value}`)} selected={activity === value} disabled={busy} onPress={() => setActivity(value)} />)}
          </View>
        </View>
        {/* Native check, 2026-09-30: at the largest text size "W przyszłym terminie" broke mid-word between the medallion and the marker.
            The start labels take the full width under them, and the bench gives back some side padding. */}
        <View testID="time-bench" style={[styles.timeWorkbench, largeText && styles.wideBench]}>
          <Text accessibilityRole="header" style={styles.label}>{t('oath.startChoice')}</Text>
          {[false, true].map(value => <GameChoice key={String(value)} label={t(value ? 'oath.scheduled' : 'oath.now')} symbol={value ? '◷' : 'ϟ'} stacked={largeText}
            selected={scheduled === value} disabled={busy} onPress={() => { setScheduled(value); setSubmitted(false); }} />)}
          {scheduled && timeFields('activation', activation, setActivation)}
          {timeFields('deadline', deadline, setDeadline)}
          {zoneFold()}
        </View>
        <Action label={t('oath.viewRules')} busy={busy} onPress={() => { void preview(); }}
          {...(!valid || (!!choices && !(choices.field === 'activation' ? activation.offset : deadline.offset))
            ? { disabled: true, unavailableReason: !valid ? t(missingChoice()) : t('oath.error.ambiguous_local_time') } : { disabled: false })} />
      </>}
    </Animated.ScrollView>
    {guideShown && <DialoguePanel frame={guideFrame}
      speaker="guide" lineId={`rules-${guideLine}`} text={bindShortWords(t(`oath.guide.${guideLine! + 1}`), i18n.language)} playerName="" portrait={null} allowed={motion} more={guideLine! < LAST_GUIDE_LINE}
      continueLabel={guideStep} onContinue={() => guideLine! < LAST_GUIDE_LINE ? setGuideLine(guideLine! + 1) : closeGuide()}
      controls={{ step: { count: `${guideLine! + 1} / ${GUIDE_CARDS.length}`, label: guideStep, text: true, onPress: () => guideLine! < LAST_GUIDE_LINE ? setGuideLine(guideLine! + 1) : closeGuide() } }}
      dismissLabel={t('room.guide.skip')} onDismiss={closeGuide} onHeight={setPanelHeight} />}
  </SafeAreaView></SceneSurface>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: tokens.space.card, paddingBottom: 36, gap: tokens.space.section },
  workbench: { gap: 14 }, offerings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' },
  timeWorkbench: { padding: 18, gap: 18, backgroundColor: tokens.warm.panel, borderRadius: 24 },
  // Full bleed from the top like the detail's band. zIndex: the band and its fade draw above the content after them.
  band: { marginHorizontal: -tokens.space.card, marginTop: -tokens.space.card, paddingHorizontal: tokens.space.card, paddingTop: tokens.space.card, paddingBottom: tokens.space.small,
    gap: tokens.space.section, backgroundColor: tokens.color.canvas, zIndex: 1 },
  bandFade: { position: 'absolute', left: 0, right: 0, top: '100%', height: 24 }, wideBench: { paddingHorizontal: 10 },
  confirmed: { gap: 14, alignItems: 'center', paddingVertical: 24 },
  track: { alignSelf: 'stretch' }, centred: { textAlign: 'center' },
  group: { gap: tokens.space.item },
  title: { color: tokens.color.text, fontFamily: tokens.font.display, fontSize: tokens.title, lineHeight: tokens.title * 1.3, fontWeight: '400' },
  label: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  choice: { minHeight: 64, padding: 18, borderWidth: 1, borderColor: tokens.warm.field, borderRadius: tokens.radius, backgroundColor: tokens.color.surface },
  selected: { backgroundColor: '#493821', borderColor: tokens.color.primary },
  // Native check, 2026-09-30: the pill sized itself to the unshrunk label, 44 + 10 + about 370 + 14 pt, and ran past the screen edge.
  // The column bounds it and the label shrinks and wraps inside.
  replay: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 10, minHeight: 44, paddingRight: 14, borderRadius: 22, backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  replayBust: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#b58a52' },
  replayImage: { width: 44, height: 44 },
  replayText: { flexShrink: 1, color: tokens.color.text, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  // "Zmień" in the text style, so the hold seal stays the only filled control (clarity.md rule 3).
  textAction: { alignSelf: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center' },
  textActionLabel: { color: tokens.color.primary, fontSize: tokens.body, lineHeight: tokens.body * 1.4, fontWeight: '600', textAlign: 'center' },
  muted: { color: tokens.color.secondary },
});
