import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { ART_STYLES, type ArtStyle } from '../art/registry';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import type { Locale } from '../localization/locale';
import type { NotificationState } from '../onboarding/notifications';
import { Action } from '../ui/Action';
import { PauseMark } from '../ui/PauseMark';
import { SceneSurface } from '../ui/SceneSurface';
import { tokens } from '../ui/tokens';

export type SettingsScreenProps = {
  /** The server-confirmed locale. The selection never runs ahead of the server. */
  locale: Locale;
  /**
   * The parent owns the language attempt: saving while its save({ locale }) call runs, error when that call resolved false.
   * It must not come from OnboardingState.busy or error, which every profile save shares.
   */
  localeState: { saving: boolean; error: boolean };
  notificationState: NotificationState;
  preference: 'enabled' | 'disabled' | null;
  character: { name: string };
  /** null while the pause state is unknown or loading. */
  paused: boolean | null;
  /** The demo's art style choice. Only the demo injects it, so production Settings has no such row. */
  artStyle?: { value: ArtStyle; onChange(style: ArtStyle): void };
  onLocale(locale: Locale): void;
  onNotifications(enabled: boolean): void;
  onRetryPermission(): void;
  onOpenSystemSettings(): void;
  onPause(): void;
  onSignOut(): void;
  onBack(): void;
};

const locales: Locale[] = ['pl', 'en'];
const gold = tokens.warm;

/** Presentational Settings. The server owns every saved value, so the screen only reflects confirmed props. */
export function SettingsScreen(props: SettingsScreenProps) {
  const { locale, localeState, notificationState, preference, character, paused, artStyle } = props;
  const { t, i18n } = useTranslation();
  // Drawn Polish prose keeps a single-letter word with the next word. Spoken labels keep the plain form.
  const prose = (key: string) => bindShortWords(t(key), i18n.language);
  const { fontScale } = useWindowDimensions();
  // One call per rendered state: a double tap before the parent answers must not send twice.
  const sent = useRef({ locale: false, signOut: false });
  useEffect(() => { sent.current = { locale: false, signOut: false }; });
  const stacked = fontScale > 1.3;
  const sectionLarge = fontScale > 1.5 && styles.sectionLarge;

  const { permission, busy, error } = notificationState;
  const enabled = preference === 'enabled';
  const blocked = enabled && (permission.kind === 'denied' || permission.kind === 'not_determined');
  const mayRetry = blocked && permission.canAskAgain;
  const mayOpenSettings = blocked && permission.kind === 'denied' && !permission.canAskAgain;
  const unknownPermission = enabled && (permission.kind === 'unavailable' || permission.kind === 'checking');
  const pauseState = paused === null ? 'unknown' : paused ? 'paused' : 'active';

  function chooseLocale(next: Locale) {
    if (localeState.saving || next === locale || sent.current.locale) return;
    sent.current.locale = true;
    props.onLocale(next);
  }
  function signOut() {
    if (sent.current.signOut) return;
    sent.current.signOut = true;
    props.onSignOut();
  }
  const section = (key: string) => <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={[styles.section, sectionLarge]}>{t(key)}</Text>;

  return <SceneSurface place="room">
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={styles.vignette} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('settings.back')} onPress={props.onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text allowFontScaling={false} style={styles.backArrow}>‹</Text>
          <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.backLabel}>{t('settings.back')}</Text>
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('settings.title')}</Text>

        <View style={styles.card}>
          {section('settings.language.title')}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.language.title')} style={[styles.options, stacked && styles.stackedOptions]}>
            {locales.map(option => {
              const selected = option === locale;
              return <Pressable key={option} accessibilityRole="radio" accessibilityLabel={t(`settings.language.${option}`)}
                accessibilityState={{ selected, disabled: localeState.saving }} disabled={localeState.saving} onPress={() => chooseLocale(option)}
                style={({ pressed }) => [styles.option, !stacked && styles.halfOption, selected && styles.selectedOption, pressed && styles.pressed, localeState.saving && styles.waiting]}>
                <Text allowFontScaling={false} accessible={false} style={[styles.optionMark, selected && styles.selectedMark]}>{selected ? '◆' : '◇'}</Text>
                <Text maxFontSizeMultiplier={tokens.maxScale.choice} style={[styles.optionLabel, selected && styles.selectedLabel]}>{t(`settings.language.${option}`)}</Text>
              </Pressable>;
            })}
          </View>
          {localeState.saving && <Text maxFontSizeMultiplier={tokens.maxScale.inset} accessibilityLiveRegion="polite" style={styles.note}>{prose('settings.language.saving')}</Text>}
          {localeState.error && !localeState.saving && <Text maxFontSizeMultiplier={tokens.maxScale.inset} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{prose('settings.language.error')}</Text>}
        </View>

        {artStyle && <View style={styles.card}>
          {section('settings.artStyle.title')}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.artStyle.title')} style={[styles.options, stacked && styles.stackedOptions]}>
            {ART_STYLES.map(option => {
              const selected = option === artStyle.value;
              return <Pressable key={option} accessibilityRole="radio" accessibilityLabel={t(`settings.artStyle.${option}`)} accessibilityState={{ selected }}
                onPress={() => { if (!selected) artStyle.onChange(option); }}
                style={({ pressed }) => [styles.option, !stacked && styles.halfOption, selected && styles.selectedOption, pressed && styles.pressed]}>
                <Text allowFontScaling={false} accessible={false} style={[styles.optionMark, selected && styles.selectedMark]}>{selected ? '◆' : '◇'}</Text>
                <Text maxFontSizeMultiplier={tokens.maxScale.choice} style={[styles.optionLabel, selected && styles.selectedLabel]}>{t(`settings.artStyle.${option}`)}</Text>
              </Pressable>;
            })}
          </View>
          <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.note}>{prose('settings.artStyle.note')}</Text>
        </View>}

        <View style={styles.card}>
          {section('settings.notifications.title')}
          <Pressable accessibilityRole="switch" accessibilityLabel={t('settings.notifications.title')} accessibilityState={{ checked: enabled, disabled: busy, busy }}
            disabled={busy} onPress={() => { if (!busy) props.onNotifications(!enabled); }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed, busy && styles.waiting]}>
            <Text maxFontSizeMultiplier={tokens.maxScale.choice} style={styles.rowLabel}>{t(enabled ? 'settings.notifications.on' : 'settings.notifications.off')}</Text>
            <View testID="notification-track" accessible={false} style={[styles.track, enabled && styles.trackOn]}><View style={[styles.knob, enabled && styles.knobOn]} /></View>
          </Pressable>
          {/* A permission action shows its own busy reason, so the note covers the other cases. */}
          {busy && !mayRetry && !mayOpenSettings && <Text maxFontSizeMultiplier={tokens.maxScale.inset} accessibilityLiveRegion="polite" style={styles.note}>{prose('settings.notifications.busy')}</Text>}
          <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.note}>{prose('settings.notifications.future')}</Text>
          {unknownPermission && <Text maxFontSizeMultiplier={tokens.maxScale.inset} accessibilityLiveRegion="polite" style={styles.body}>{prose(`settings.notifications.permission_${permission.kind}`)}</Text>}
          {blocked && <Text maxFontSizeMultiplier={tokens.maxScale.inset} accessibilityLiveRegion="polite" style={styles.body}>{prose(mayOpenSettings ? 'settings.notifications.denied' : 'settings.notifications.notAllowed')}</Text>}
          {mayRetry && <Action label={t('settings.notifications.askPermission')} onPress={props.onRetryPermission} busy={busy} variant="secondary" />}
          {mayOpenSettings && <Action label={t('settings.notifications.openSettings')} onPress={props.onOpenSystemSettings} busy={busy} variant="secondary" />}
          {error && <Text maxFontSizeMultiplier={tokens.maxScale.inset} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{prose(`settings.notifications.error_${error}`)}</Text>}
        </View>

        <View style={styles.card}>
          {section('settings.pause.title')}
          <Pressable accessibilityRole="button" accessibilityLabel={t(`settings.pause.row_${pauseState}`, { name: character.name })} accessibilityHint={t('settings.pause.hint')}
            onPress={props.onPause} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.identity}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={tokens.maxScale.name} style={styles.name}>{character.name}</Text>
              <PauseMark state={pauseState} />
            </View>
            <Text allowFontScaling={false} style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {section('settings.account.title')}
          {/* A plain row like the pause row, so the label lines up with the card content (MVP-22-B1, G9). */}
          <Pressable accessibilityRole="button" accessibilityLabel={t('settings.account.signOut')} onPress={signOut} style={({ pressed }) => [styles.row, styles.controlRow, pressed && styles.pressed]}>
            <Text maxFontSizeMultiplier={tokens.maxScale.choice} style={styles.rowLabel}>{t('settings.account.signOut')}</Text>
            <Text allowFontScaling={false} style={styles.chevron}>›</Text>
          </Pressable>
        </View>
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
  title: { fontFamily: tokens.font.display, color: gold.name, fontSize: 30, lineHeight: 36, textAlign: 'center', marginBottom: 8 },
  card: { borderRadius: 22, borderWidth: 1, borderColor: gold.line, padding: 16, gap: 12,
    backgroundColor: '#1f1812', experimental_backgroundImage: 'linear-gradient(180deg, rgba(42,31,21,0.94) 0%, rgba(24,19,14,0.94) 100%)' },
  section: { color: gold.role, fontSize: 13, lineHeight: 18, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '600' },
  sectionLarge: { letterSpacing: 1 },
  options: { flexDirection: 'row', gap: 12 },
  stackedOptions: { flexDirection: 'column' },
  option: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: gold.faint, backgroundColor: 'rgba(15,16,18,0.6)', paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10 },
  halfOption: { flex: 1 },
  selectedOption: { borderColor: gold.bright, backgroundColor: '#3c3023' },
  optionMark: { color: tokens.color.secondary, fontSize: 16 },
  selectedMark: { color: gold.bright },
  optionLabel: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.4, fontWeight: '600', flexShrink: 1 },
  selectedLabel: { color: gold.name },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14 },
  controlRow: { minHeight: tokens.controlHeight },
  rowLabel: { flex: 1, color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600' },
  track: { width: 52, height: 32, borderRadius: 16, padding: 3, backgroundColor: tokens.warm.raised, borderWidth: 1, borderColor: tokens.warm.faint, justifyContent: 'center' },
  trackOn: { backgroundColor: '#775029', borderColor: gold.bright },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: tokens.color.secondary },
  knobOn: { alignSelf: 'flex-end', backgroundColor: gold.bright },
  identity: { flex: 1, gap: 2 },
  name: { fontFamily: tokens.font.display, color: gold.name, fontSize: 22, lineHeight: 28 },
  chevron: { color: tokens.color.primary, fontSize: 26 },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  note: { color: tokens.color.secondary, fontSize: 15, lineHeight: 22 },
  error: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217,163,144,0.5)',
    backgroundColor: 'rgba(217,163,144,0.08)', padding: 12, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  waiting: { opacity: 0.6 },
});
