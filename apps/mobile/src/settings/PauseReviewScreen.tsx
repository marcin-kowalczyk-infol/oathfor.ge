import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import type { Character } from '../api/characters';
import type { Oath } from '../api/oathSchema';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { bindShortWords } from '../localization/typography';
import type { OathController } from '../oaths/controller';
import { loadPauseReview, type PauseReview } from '../oaths/pauseReview';
import { pathTimeText } from '../oaths/compactStoredTime';
import { zoneLabel } from '../oaths/zoneLabel';
import { Action } from '../ui/Action';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { layoutMode } from '../ui/layoutMode';
import { PauseMark } from '../ui/PauseMark';
import { SceneSurface } from '../ui/SceneSurface';
import { tokens } from '../ui/tokens';

export type PauseReviewScreenProps = {
  /** Bound to the active character. Pause and resume apply only to it. */
  controller: OathController;
  character: Character;
  onBack(): void;
  /** Called once after the server confirmed a pause or resume. The parent returns to Settings. */
  onChanged(): void;
};

const gold = { line: 'rgba(214,170,105,0.55)', role: '#caa06a', name: '#f6e6c8' };

/** The pause review of one character. Every change is confirmed against the reviewed revision. */
export function PauseReviewScreen({ controller, character, onBack, onChanged }: PauseReviewScreenProps) {
  const { t, i18n } = useTranslation(); const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { width, fontScale } = useWindowDimensions();
  const simple = layoutMode(width, fontScale) === 'simple';
  const account = useSyncExternalStore(controller.subscribe, controller.getState);
  const available = account.kind === 'ready';
  const [pause, setPause] = useState<PauseReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pauseChanged, setPauseChanged] = useState<null | 'oaths' | 'character'>(null);
  const [pauseFailed, setPauseFailed] = useState(false);
  const generation = useRef(0);
  const mutation = useRef<symbol | undefined>(undefined);
  const [mutating, setMutating] = useState(false);
  const current = (epoch: number) => epoch === generation.current;
  async function showPause(changed: null | 'oaths' | 'character' = null) {
    const epoch = ++generation.current;
    setPause(null); setLoading(true); setFailed(false); setPauseFailed(false); setPauseChanged(changed);
    const result = await loadPauseReview(controller);
    if (!current(epoch)) return;
    setLoading(false);
    if (result.kind === 'success') setPause(result.value); else setFailed(true);
  }
  // A revalidated controller drops any unfinished change and loads the review again.
  useEffect(() => {
    mutation.current = undefined; setMutating(false);
    if (available) void showPause();
    return () => { generation.current++; mutation.current = undefined; };
  }, [available, controller]);
  async function changePause() {
    if (!pause || mutation.current) return;
    const operation = Symbol('pause'); mutation.current = operation; setMutating(true);
    const epoch = generation.current;
    // The controller sends its bound character. A switch elsewhere gives character_changed and the app rebinds.
    const result = await controller.pause(pause.summary.paused ? { paused: false } : { paused: true, revision: pause.summary.revision });
    if (mutation.current !== operation) return;
    // A confirmed change stays locked until the parent leaves, so it is never sent twice.
    if (result.kind === 'success' && current(epoch)) { onChanged(); return; }
    mutation.current = undefined;
    setMutating(false);
    if (!current(epoch)) return;
    if (result.kind === 'oath_error' && result.code === 'pause_preview_changed') { await showPause('oaths'); return; }
    // Another character is active now. Nothing is reloaded or sent until the app has rebound to it.
    if (result.kind === 'oath_error' && result.code === 'character_changed') { setPause(null); setPauseChanged('character'); setPauseFailed(true); return; }
    setPause(null); setPauseFailed(true);
  }
  // One plain line at a time (docs/product/clarity.md decision 14). An error replaces the intro, the most specific error wins.
  const notice = pauseChanged === 'character' ? 'oath.error.character_changed' : pauseFailed ? 'oathHome.pauseError' : failed ? 'oathHome.loadError'
    : pauseChanged === 'oaths' ? 'oathHome.pauseChanged' : null;
  const line = notice ?? (pause ? (pause.summary.paused ? 'oathHome.paused' : 'oathHome.pauseIntro') : null);
  // The short path time with the zone label. The offset appears only in the repeated hour (MVP-22-B1, G10).
  function summary(item: Oath) {
    const { deadline } = item.snapshot;
    return bindShortWords(t('oathHome.summary', { activity: item.snapshot.copy[locale].activity, deadline: `${pathTimeText(deadline, locale)} · ${zoneLabel(deadline.timezone, t)}` }), locale);
  }

  return <SceneSurface place="room">
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={styles.vignette} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* An unanswered change keeps the player here, so its result is never lost. */}
        <Pressable accessibilityRole="button" accessibilityLabel={t('settings.pause.back')} accessibilityState={{ disabled: mutating }} disabled={mutating}
          onPress={() => { if (!mutation.current) onBack(); }} style={({ pressed }) => [styles.back, pressed && styles.pressed, mutating && styles.waiting]}>
          <Text allowFontScaling={false} style={styles.backArrow}>‹</Text>
          <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.backLabel}>{t('settings.pause.back')}</Text>
        </Pressable>
        <View style={styles.header}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('oathHome.pauseTitle')}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={tokens.maxScale.name} style={styles.name}>{character.name}</Text>
          {/* No mark while the review loads. "Unknown" is shown only once loading failed (MVP-22-A4b). */}
          {(pause || failed || pauseFailed) && <PauseMark state={pause ? (pause.summary.paused ? 'paused' : 'active') : 'unknown'} />}
        </View>
        {!available && <>
          <Text accessibilityLiveRegion="polite" style={styles.body}>{t(account.kind === 'storage_unavailable' ? 'oath.storageError' : 'oathHome.loading')}</Text>
          {account.kind === 'storage_unavailable' && <Action label={t('oath.retry')} onPress={() => { void controller.refresh(); }} />}
        </>}
        {available && <>
          {loading && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('oathHome.loading')}</Text>}
          {line && <Text testID="pause-line" maxFontSizeMultiplier={tokens.maxScale.inset} accessibilityRole={notice ? 'alert' : undefined} accessibilityLiveRegion="polite"
            style={notice ? styles.notice : styles.body}>{bindShortWords(t(line), locale)}</Text>}
          {(failed || pauseFailed) && <Action label={t('oathHome.reviewPause')} onPress={() => { void showPause(); }} />}
          {pause && <>
            {(['withdraw', 'preserve'] as const).map(key => <View key={key} style={styles.card}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={[styles.section, fontScale > 1.5 && styles.sectionLarge]}>{t(`oathHome.${key}`)}</Text>
              {pause[key].length === 0 && <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.body}>{t('oathHome.none')}</Text>}
              {pause[key].map(item => <View key={item.id} style={[styles.entry, simple && styles.stackedEntry]}><ActivityEmblem activity={item.snapshot.activity} size={52} /><Text maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.body, styles.entryCopy]}>{summary(item)}</Text></View>)}
            </View>)}
            <Action label={t(pause.summary.paused ? 'oathHome.resume' : 'oathHome.confirmPause')} busy={mutating} onPress={() => { void changePause(); }} />
          </>}
        </>}
      </ScrollView>
    </SafeAreaView>
  </SceneSurface>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, experimental_backgroundImage: 'radial-gradient(120% 60% at 50% 22%, rgba(255,150,60,0.10) 0%, rgba(255,150,60,0) 60%)' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, alignSelf: 'flex-start', paddingRight: 12 },
  backArrow: { color: tokens.color.primary, fontSize: 30, lineHeight: 32 },
  backLabel: { color: '#e5d4b2', fontFamily: tokens.font.display, fontSize: 17, lineHeight: 24, flexShrink: 1 },
  header: { alignItems: 'center', gap: 4, marginBottom: 8 },
  title: { fontFamily: tokens.font.display, color: gold.name, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  name: { fontFamily: tokens.font.display, color: gold.role, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  card: { borderRadius: 22, borderWidth: 1, borderColor: gold.line, padding: 16, gap: 12,
    backgroundColor: '#1f1812', experimental_backgroundImage: 'linear-gradient(180deg, rgba(42,31,21,0.94) 0%, rgba(24,19,14,0.94) 100%)' },
  section: { color: gold.role, fontSize: 13, lineHeight: 18, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '600' },
  sectionLarge: { letterSpacing: 1 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  stackedEntry: { flexDirection: 'column', alignItems: 'flex-start' },
  entryCopy: { flexShrink: 1 },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  notice: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217,163,144,0.5)',
    backgroundColor: 'rgba(217,163,144,0.08)', padding: 12, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  waiting: { opacity: 0.6 },
});
