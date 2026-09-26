import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Character } from '../api/characters';
import { useTranslation } from '../localization/LocalizationProvider';
import { tokens } from '../ui/tokens';
import { useSceneEntrance } from '../ui/useSceneEntrance';
import { CharacterPortrait } from './CharacterPortrait';
import type { CharacterControllerState, CharacterError } from './controller';

type Ready = Extract<CharacterControllerState, { kind: 'ready' }>;
export type ChangeCharacterScreenProps = { state: Ready; onChoose(characterId: string): void; onNew(): void; onBack(): void };
const gold = { line: 'rgba(214,170,105,0.55)', faint: 'rgba(214,170,105,0.22)', bright: '#f0c987', role: '#caa06a', name: '#f6e6c8' };

function errorKey(error: CharacterError | undefined): string | null {
  if (!error || error.kind === 'reauthenticate') return null;
  if (error.kind === 'character_error' && error.code === 'not_found') return 'character.change.error.not_found';
  if (error.kind === 'unavailable' || error.kind === 'rate_limited' || error.kind === 'cancelled') return 'character.error.unavailable';
  return 'character.change.error.generic';
}

/** Up to three character cards. Choosing another card makes it active, the active card or Back returns without a request. */
export function ChangeCharacterScreen({ state, onChoose, onNew, onBack }: ChangeCharacterScreenProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const entrance = useSceneEntrance('change-character');
  const sent = useRef(false);
  // Only an answer to a choice made here is shown, not an older error from creation.
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { sent.current = false; }, [state]);
  const stacked = fontScale > 1.3;
  const message = attempted && !state.busy ? errorKey(state.error) : null;
  const pending = state.pendingCreation;
  function choose(character: Character) {
    if (state.busy) return;
    if (character.id === state.activeCharacterId) { onBack(); return; }
    if (sent.current || pending) return;
    sent.current = true; setAttempted(true);
    onChoose(character.id);
  }
  // iOS keeps stale text measurements after a live Dynamic Type change, so the content remounts, as in SceneSurface.
  return <SafeAreaView style={styles.root}>
    <View pointerEvents="none" style={styles.vignette} />
    <ScrollView key={fontScale} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('character.change.back')} accessibilityState={{ disabled: state.busy }} disabled={state.busy}
        onPress={() => { if (!state.busy) onBack(); }} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text allowFontScaling={false} style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>{t('character.change.back')}</Text>
      </Pressable>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{t('character.change.title')}</Text>
        <Text style={styles.intro}>{t('character.change.intro')}</Text>
      </View>
      <Animated.View testID="character-cards" style={[styles.cards, entrance]}>
        {state.characters.map(character => {
          const active = character.id === state.activeCharacterId;
          const title = t(`character.form.${character.form}`);
          const waiting = state.busy || (pending !== null && !active);
          return <Pressable key={character.id} accessibilityRole="button" accessibilityState={{ selected: active, disabled: waiting }} disabled={waiting}
            accessibilityLabel={t(active ? 'character.change.cardActive' : 'character.change.card', { name: character.name, title })}
            onPress={() => choose(character)} style={({ pressed }) => [styles.card, active && styles.activeCard, stacked && styles.stackedCard, pressed && styles.pressed]}>
            <View pointerEvents="none" style={[styles.glow, active && styles.activeGlow]} />
            <CharacterPortrait id={character.id} presetId={character.presetId} name={character.name} size={72} active={active} />
            <View style={[styles.identity, stacked && styles.stackedIdentity]}>
              <Text style={styles.name}>{character.name}</Text>
              <Text style={styles.role}>{title}</Text>
              {active && <View style={styles.activeLabel}><Text allowFontScaling={false} style={styles.activeMark}>✓</Text><Text style={styles.activeText}>{t('character.change.active')}</Text></View>}
            </View>
            <View pointerEvents="none" style={[styles.innerFrame, active && styles.activeInnerFrame]} />
          </Pressable>;
        })}
        {pending ? <Pressable accessibilityRole="button" accessibilityLabel={t('character.change.resume', { name: pending.name })} accessibilityState={{ disabled: state.busy }} disabled={state.busy}
            onPress={() => { if (!state.busy) onNew(); }} style={({ pressed }) => [styles.card, styles.newCard, stacked && styles.stackedCard, pressed && styles.pressed]}>
            <CharacterPortrait id={pending.requestId} presetId={pending.presetId} name={pending.name} size={72} />
            <View style={[styles.identity, stacked && styles.stackedIdentity]}>
              <Text style={styles.newTitle}>{t('character.change.resume', { name: pending.name })}</Text>
              <Text style={styles.detail}>{t('character.change.resumeDetail')}</Text>
            </View>
          </Pressable>
          : state.characters.length < state.limit
          ? <Pressable accessibilityRole="button" accessibilityLabel={t('character.change.new')} accessibilityState={{ disabled: state.busy }} disabled={state.busy}
            onPress={() => { if (!state.busy) onNew(); }} style={({ pressed }) => [styles.card, styles.newCard, stacked && styles.stackedCard, pressed && styles.pressed]}>
            <View style={styles.plus}><Text allowFontScaling={false} style={styles.plusMark}>+</Text></View>
            <View style={[styles.identity, stacked && styles.stackedIdentity]}>
              <Text style={styles.newTitle}>{t('character.change.new')}</Text>
              <Text style={styles.detail}>{t('character.change.newDetail')}</Text>
            </View>
          </Pressable>
          : <Text style={styles.detail}>{t('character.change.full')}</Text>}
      </Animated.View>
      {pending && <Text style={styles.intro}>{t('character.change.pending', { name: pending.name })}</Text>}
      {state.busy && <Text accessibilityLiveRegion="polite" style={styles.intro}>{t('character.change.switching')}</Text>}
      {message && <View style={styles.message}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.messageText}>{t(message)}</Text></View>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1012' },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, experimental_backgroundImage: 'radial-gradient(120% 60% at 50% 22%, rgba(255,150,60,0.10) 0%, rgba(255,150,60,0) 60%)' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, alignSelf: 'flex-start', paddingRight: 12 },
  backArrow: { color: tokens.color.primary, fontSize: 30, lineHeight: 32 },
  backLabel: { color: '#e5d4b2', fontFamily: tokens.font.display, fontSize: 17, lineHeight: 24, flexShrink: 1 },
  header: { gap: 8 },
  title: { fontFamily: tokens.font.display, color: gold.name, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  intro: { color: tokens.color.secondary, fontSize: tokens.body, lineHeight: tokens.body * 1.5, textAlign: 'center' },
  cards: { gap: 12 },
  card: { minHeight: 112, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: gold.line, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16,
    backgroundColor: '#1f1812', experimental_backgroundImage: 'linear-gradient(180deg, #2a1f15 0%, #18130e 100%)' },
  activeCard: { borderColor: gold.bright },
  stackedCard: { flexDirection: 'column', alignItems: 'flex-start' },
  pressed: { opacity: 0.85 },
  glow: { position: 'absolute', left: -40, top: 0, bottom: 0, width: 200, experimental_backgroundImage: 'radial-gradient(closest-side, rgba(255,160,70,0.16) 0%, rgba(255,160,70,0) 100%)' },
  activeGlow: { experimental_backgroundImage: 'radial-gradient(closest-side, rgba(255,160,70,0.30) 0%, rgba(255,160,70,0) 100%)' },
  innerFrame: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: 17, borderWidth: 1, borderColor: gold.faint },
  activeInnerFrame: { borderColor: 'rgba(240,201,135,0.45)' },
  identity: { flex: 1, gap: 4 },
  stackedIdentity: { flex: 0, alignSelf: 'stretch' },
  name: { fontFamily: tokens.font.display, color: gold.name, fontSize: 24, lineHeight: 30 },
  role: { color: gold.role, fontSize: 13, lineHeight: 18, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '600' },
  activeLabel: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(214,170,105,0.14)', borderWidth: 1, borderColor: gold.line },
  activeMark: { color: gold.bright, fontSize: 13, fontWeight: '800' },
  activeText: { color: gold.bright, fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  newCard: { borderStyle: 'dashed', backgroundColor: 'rgba(24,19,14,0.6)', experimental_backgroundImage: undefined },
  plus: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: gold.line, alignItems: 'center', justifyContent: 'center' },
  plusMark: { color: gold.bright, fontSize: 34, lineHeight: 38, fontFamily: tokens.font.display },
  newTitle: { fontFamily: tokens.font.display, color: gold.name, fontSize: 22, lineHeight: 28 },
  detail: { color: tokens.color.secondary, fontSize: 15, lineHeight: 22 },
  message: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(217,163,144,0.5)', backgroundColor: 'rgba(217,163,144,0.08)', padding: 14 },
  messageText: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
