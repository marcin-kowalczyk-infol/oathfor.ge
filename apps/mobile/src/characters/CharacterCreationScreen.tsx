import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { CharacterForm } from '../api/characters';
import { useTranslation } from '../localization/LocalizationProvider';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import type { CharacterControllerState, CharacterDraft, CharacterError } from './controller';
import { validateCharacterName } from './name';
import { drawablePresets, presetArt } from './presetArt';

export type CharacterCreationDraft = { name: string; presetId: string | null; form: CharacterForm | null };
export const emptyCreationDraft: CharacterCreationDraft = { name: '', presetId: null, form: null };
export type CharacterCreationScreenProps = {
  state: CharacterControllerState;
  draft: CharacterCreationDraft;
  onDraft(patch: Partial<CharacterCreationDraft>): void;
  onCreate(draft: CharacterDraft): void;
  onRetry(): void;
  onReload(): void;
};

const forms: CharacterForm[] = ['masculine', 'feminine', 'neutral'];
const gold = { line: 'rgba(214,170,105,0.55)', faint: 'rgba(214,170,105,0.22)', bright: '#f0c987', role: '#caa06a', name: '#f6e6c8' };
const FIGURE_RATIO = 400 / 984;
const STAGE_TOP = 24;
const STAGE_BOTTOM = 10;
const GLOW = 360;
const POOL = 44;
type Ready = Extract<CharacterControllerState, { kind: 'ready' }>;
type Translate = ReturnType<typeof useTranslation>['t'];

function errorKey(error: CharacterError | undefined, pendingName: string | null): { key: string; name?: string } | null {
  if (!error || error.kind === 'reauthenticate') return null;
  if (error.kind === 'storage') return { key: 'character.error.storage' };
  // Anything short of a decisive answer leaves the stored creation waiting for a retry.
  if (pendingName !== null) return { key: 'character.pending', name: pendingName };
  if (error.kind === 'unavailable' || error.kind === 'rate_limited' || error.kind === 'cancelled') return { key: 'character.error.unavailable' };
  if (error.kind === 'character_error' && ['invalid_character_name', 'invalid_preset', 'character_limit_reached', 'onboarding_incomplete'].includes(error.code)) return { key: `character.error.${error.code}` };
  return { key: 'character.error.generic' };
}

/** Seconds left of a server rate limit, counted from when the error arrived. */
function useRateLimitWait(error: CharacterError | undefined): number {
  const initial = error?.kind === 'rate_limited' ? error.retryAfterSeconds : 0;
  const [wait, setWait] = useState({ error, left: initial });
  useEffect(() => {
    if (error?.kind !== 'rate_limited') { setWait({ error, left: 0 }); return; }
    const until = Date.now() + error.retryAfterSeconds * 1000;
    const tick = () => { const left = Math.max(0, Math.ceil((until - Date.now()) / 1000)); setWait({ error, left }); return left; };
    tick();
    const timer = setInterval(() => { if (tick() === 0) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [error]);
  return wait.error === error ? wait.left : initial;
}

/** Full-screen creation of a player character. Presentational: the character controller owns requests and retries. */
export function CharacterCreationScreen(props: CharacterCreationScreenProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const { state, onReload } = props;
  // iOS keeps stale text measurements after a live Dynamic Type change, so the content remounts, as in SceneSurface.
  return <SafeAreaView style={styles.root}>
    <View pointerEvents="none" style={styles.vignette} />
    <View key={fontScale} style={styles.fill}>
      {state.kind === 'ready' ? <CreationForm {...props} state={state} />
        : <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>{t('character.title')}</Text>
          {state.kind === 'loading' || state.kind === 'idle'
            ? <Text accessibilityLiveRegion="polite" style={styles.intro}>{t('character.loading')}</Text>
            : <>
              <Message text={t(state.kind === 'storage_unavailable' ? 'character.storageUnavailable' : 'character.error.unavailable')} />
              <Action label={t('character.retry')} onPress={onReload} />
            </>}
        </ScrollView>}
    </View>
  </SafeAreaView>;
}

function CreationForm({ state, draft, onDraft, onCreate, onRetry, onReload }: CharacterCreationScreenProps & { state: Ready }) {
  const { t } = useTranslation();
  const { height, fontScale } = useWindowDimensions();
  const entrance = useSceneEntrance('character-creation');
  const submitted = useRef(false);
  // A new controller state answers the previous press, so a later press may submit again.
  useEffect(() => { submitted.current = false; }, [state]);
  const pending = state.pendingCreation;
  // The stored choices become the draft, so a later decisive rejection still shows them for editing.
  useEffect(() => { if (pending) onDraft({ name: pending.name, presetId: pending.presetId, form: pending.form }); }, [pending?.requestId]);
  const wait = useRateLimitWait(state.error);
  const looks = drawablePresets(state.presets);
  const name = pending?.name ?? draft.name;
  const presetId = pending?.presetId ?? (draft.presetId !== null && looks.includes(draft.presetId) ? draft.presetId : looks[0] ?? null);
  const form = pending?.form ?? draft.form;
  const locked = state.busy || pending !== null;
  const check = validateCharacterName(name);
  const nameProblem = name !== '' && !check.valid ? check.reason : null;
  const full = state.characters.length >= state.limit;
  const art = presetId === null ? null : presetArt(presetId);
  // Large text leaves more room for words, the figure is decorative and may shrink.
  const figureHeight = Math.round(Math.min(340, Math.max(200, height * (fontScale > 1.5 ? 0.28 : 0.36))));
  const stageHeight = figureHeight + STAGE_TOP + STAGE_BOTTOM;
  // The feet stand a little above the name panel, the light pool is centred on them.
  const feet = stageHeight - STAGE_BOTTOM;
  const title = form ? t(`character.form.${form}`) : t('character.untitled');
  const message = errorKey(state.error, pending?.name ?? null);
  const limitShown = message?.key === 'character.error.character_limit_reached';
  const waitText = pending && wait > 0 ? t('character.rateLimited', { count: wait, name: pending.name }) : undefined;
  const serverNameError = state.error?.kind === 'character_error' && state.error.code === 'invalid_character_name' ? t('character.error.invalid_character_name') : undefined;
  const reason = full ? t('character.error.character_limit_reached')
    : presetId === null ? t('character.unmetLook')
    : !check.valid && !form ? t('character.unmet')
    : !check.valid ? t('character.unmetName')
    : !form ? t('character.unmetForm') : undefined;
  function submit() {
    if (locked || reason || submitted.current || !check.valid || !form || presetId === null) return;
    submitted.current = true;
    onCreate({ name: check.name, presetId, form });
  }
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>{t('character.title')}</Text>
      <Text style={styles.intro}>{t('character.intro')}</Text>
    </View>

    <Animated.View testID="character-preview" style={[styles.card, entrance]}>
      {/* The light spans the whole card and fades out on every side, so no edge cuts it where the name panel begins. */}
      <View testID="character-glow" pointerEvents="none" style={[styles.glow, { top: feet - GLOW / 2 }]} />
      <View testID="character-pool" pointerEvents="none" style={[styles.pool, { top: feet - POOL / 2 }]} />
      <View accessible accessibilityLabel={t('character.preview', { name: check.valid ? check.name : t('character.unnamed'), title })}>
        <View testID="character-stage" style={[styles.stage, { height: stageHeight }]}>
          {art ? <Image source={art.figure} resizeMode="contain" accessibilityIgnoresInvertColors style={{ height: figureHeight, width: figureHeight * FIGURE_RATIO }} />
            : <View testID="character-placeholder" style={[styles.placeholder, { height: figureHeight * 0.8, width: figureHeight * 0.8 * FIGURE_RATIO }]} />}
        </View>
        <View style={styles.identity}>
          <Text style={[styles.cardName, !check.valid && styles.cardNameEmpty]}>{check.valid ? check.name : t('character.unnamed')}</Text>
          <Text style={[styles.role, !form && styles.roleEmpty]}>{title}</Text>
          <View style={styles.rule} />
        </View>
      </View>
      {art?.dummy && <View style={styles.dummy} accessible accessibilityLabel={t('character.dummyLabel')}>
        <Text allowFontScaling={false} style={styles.dummyText}>{t('character.dummy')}</Text>
      </View>}
      <View pointerEvents="none" style={styles.innerFrame} />
    </Animated.View>

    <View style={styles.section}>
      <Text style={styles.label}>{t('character.looks')}</Text>
      {looks.length === 0 ? <>
        <Message text={t('character.noLooks')} />
        <Action variant="secondary" label={t('character.reloadLooks')} onPress={onReload} />
      </> : <ScrollView testID="character-looks" horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t('character.looks')} style={styles.lookRow} contentContainerStyle={styles.looks}>
        {looks.map((id, index) => {
          const selected = id === presetId;
          return <Pressable key={id} accessibilityRole="radio" accessibilityLabel={t('character.look', { index: index + 1, count: looks.length })}
            accessibilityState={{ selected, disabled: locked }} disabled={locked} onPress={() => { if (!locked) onDraft({ presetId: id }); }}
            style={({ pressed }) => [styles.portraitRing, selected && styles.portraitSelected, pressed && styles.pressed]}>
            <Image source={presetArt(id)!.portrait} style={styles.portrait} />
            {selected && <View style={styles.check}><Text allowFontScaling={false} style={styles.checkText}>✓</Text></View>}
          </Pressable>;
        })}
      </ScrollView>}
    </View>

    <View style={styles.section}>
      <Text nativeID="character-name-label" style={styles.label}>{t('character.name')}</Text>
      <TextInput accessibilityLabel={t('character.name')} accessibilityLabelledBy="character-name-label" accessibilityHint={nameProblem !== null ? t(`character.nameError.${nameProblem}`) : serverNameError ?? t('character.nameHint')}
        value={name} editable={!locked} onChangeText={value => { if (!locked) onDraft({ name: value }); }}
        autoCapitalize="words" autoCorrect={false} autoComplete="off" textContentType="none" importantForAutofill="no" spellCheck={false} maxLength={40} returnKeyType="done"
        style={[styles.input, nameProblem !== null && styles.inputProblem, locked && styles.inputLocked]} />
      {nameProblem !== null
        ? <Text accessibilityLiveRegion="polite" style={styles.problem}>{t(`character.nameError.${nameProblem}`)}</Text>
        : <Text style={styles.hint}>{t('character.nameHint')}</Text>}
    </View>

    <View style={styles.section} accessibilityRole="radiogroup" accessibilityLabel={t('character.titles')}>
      <Text style={styles.label}>{t('character.titles')}</Text>
      {forms.map(option => <FormChoice key={option} t={t} form={option} selected={form === option} disabled={locked} onPress={() => onDraft({ form: option })} />)}
      <Text style={styles.hint}>{t('character.titlesHint')}</Text>
    </View>

    {message && !(limitShown && full) && !waitText && <Message text={t(message.key, message.name === undefined ? {} : { name: message.name })} />}
    {pending && state.busy && <Text accessibilityLiveRegion="polite" style={styles.intro}>{t('character.finishing', { name: pending.name })}</Text>}
    {state.error?.kind === 'character_error' && state.error.code === 'invalid_preset' && !state.busy
      && <Action variant="secondary" label={t('character.reloadLooks')} onPress={onReload} />}

    {pending
      ? <Action label={t('character.retry')} onPress={onRetry} busy={state.busy}
        {...(waitText && !state.busy ? { disabled: true, unavailableReason: waitText } : { disabled: false })} />
      : <Action label={t('character.create')} onPress={submit} busy={state.busy}
        {...(reason && !state.busy ? { disabled: true, unavailableReason: reason } : { disabled: false })} />}
  </ScrollView>;
}

function FormChoice({ t, form, selected, disabled, onPress }: { t: Translate; form: CharacterForm; selected: boolean; disabled: boolean; onPress(): void }) {
  const title = t(`character.form.${form}`);
  const detail = t(`character.form.${form}Detail`);
  return <Pressable accessibilityRole="radio" accessibilityLabel={t('character.formChoice', { title, detail })} accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={() => { if (!disabled) onPress(); }}
    style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
    <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <Text allowFontScaling={false} style={styles.radioMark}>✓</Text>}</View>
    <View style={styles.choiceText}>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={styles.choiceDetail}>{detail}</Text>
    </View>
  </Pressable>;
}

function Message({ text }: { text: string }) {
  return <View style={styles.message}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.messageText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1012' },
  fill: { flex: 1 },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, experimental_backgroundImage: 'radial-gradient(120% 60% at 50% 22%, rgba(255,150,60,0.10) 0%, rgba(255,150,60,0) 60%)' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 24 },
  header: { gap: 8 },
  title: { fontFamily: tokens.font.display, color: gold.name, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  intro: { color: tokens.color.secondary, fontSize: tokens.body, lineHeight: tokens.body * 1.5, textAlign: 'center' },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: gold.line, backgroundColor: '#1f1812',
    experimental_backgroundImage: 'linear-gradient(180deg, #2a1f15 0%, #18130e 100%)' },
  innerFrame: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: 19, borderWidth: 1, borderColor: gold.faint },
  stage: { alignItems: 'center', justifyContent: 'flex-end', paddingTop: STAGE_TOP, paddingBottom: STAGE_BOTTOM },
  glow: { position: 'absolute', left: 0, right: 0, height: GLOW, experimental_backgroundImage: 'radial-gradient(70% 50% at 50% 50%, rgba(255,160,70,0.26) 0%, rgba(255,160,70,0.11) 50%, rgba(255,160,70,0) 100%)' },
  pool: { position: 'absolute', left: '50%', marginLeft: -110, width: 220, height: POOL, borderRadius: 110, experimental_backgroundImage: 'radial-gradient(closest-side, rgba(255,176,92,0.42) 0%, rgba(255,176,92,0) 100%)' },
  placeholder: { borderRadius: 999, borderWidth: 1, borderColor: gold.faint, marginBottom: 12 },
  identity: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, gap: 6 },
  cardName: { fontFamily: tokens.font.display, color: gold.name, fontSize: 28, lineHeight: 34, textAlign: 'center' },
  cardNameEmpty: { color: tokens.color.secondary, fontStyle: 'italic' },
  role: { color: gold.role, fontSize: 13, lineHeight: 18, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '600', textAlign: 'center' },
  roleEmpty: { color: tokens.color.secondary },
  rule: { marginTop: 10, width: 140, height: 1, experimental_backgroundImage: 'linear-gradient(90deg, rgba(214,170,105,0) 0%, rgba(214,170,105,0.7) 50%, rgba(214,170,105,0) 100%)' },
  dummy: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: gold.line, backgroundColor: 'rgba(20,15,10,0.85)' },
  dummyText: { color: gold.role, fontSize: 11, lineHeight: 14, letterSpacing: 1.5, fontWeight: '700' },
  section: { gap: 12 },
  label: { color: gold.role, fontSize: 13, lineHeight: 18, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600' },
  // Padding keeps the selected glow inside the scroll bounds, the negative margin keeps the row aligned.
  lookRow: { margin: -12 },
  // Centred while the portraits fit, scrollable once they overflow.
  looks: { flexGrow: 1, justifyContent: 'center', gap: 12, padding: 12 },
  portraitRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: gold.faint, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18130e' },
  portraitSelected: { borderWidth: 2, borderColor: gold.bright, shadowColor: '#ffa446', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  portrait: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#1f1812' },
  check: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: tokens.color.primary, borderWidth: 2, borderColor: '#0f1012', alignItems: 'center', justifyContent: 'center' },
  checkText: { color: tokens.color.canvas, fontSize: 13, lineHeight: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(214,170,105,0.35)', backgroundColor: '#1b1714', color: tokens.color.text,
    fontSize: 19, fontFamily: tokens.font.display, paddingHorizontal: 16, paddingVertical: 12 },
  inputProblem: { borderColor: tokens.color.missed },
  inputLocked: { color: tokens.color.secondary },
  problem: { color: tokens.color.missed, fontSize: 15, lineHeight: 22 },
  hint: { color: tokens.color.secondary, fontSize: 15, lineHeight: 22 },
  choice: { minHeight: 64, borderRadius: 20, borderWidth: 1, borderColor: gold.faint, backgroundColor: '#1b1714', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  choiceSelected: { borderColor: gold.bright, backgroundColor: '#2e2318' },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: gold.line, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  radioMark: { color: tokens.color.canvas, fontSize: 14, lineHeight: 17, fontWeight: '800' },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontFamily: tokens.font.display, color: gold.name, fontSize: 19, lineHeight: 25 },
  choiceDetail: { color: tokens.color.secondary, fontSize: 15, lineHeight: 21 },
  message: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(217,163,144,0.5)', backgroundColor: 'rgba(217,163,144,0.08)', padding: 14 },
  messageText: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
