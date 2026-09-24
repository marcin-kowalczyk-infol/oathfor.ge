import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isSupportedTimezone } from '../api/profile';
import { useTranslation } from '../localization/LocalizationProvider';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import type { BasicsDraft, OnboardingState } from './controller';

export type OnboardingViewProps = {
  state: OnboardingState;
  onDraft: (patch: Partial<BasicsDraft>) => void;
  onSave: () => void;
  onRetry: () => void;
  onLogout: () => void;
};
export function OnboardingView({ state, onDraft, onSave, onRetry, onLogout }: OnboardingViewProps) {
  const { t } = useTranslation();
  const ready = state.kind === 'ready' ? state : undefined;
  const profile = ready?.value.profile;
  const complete = ready?.value.onboardingStatus === 'complete';
  const basics = ready && !complete && (!profile?.locale || !isSupportedTimezone(profile.timezone) || !profile.intention);
  let heading = t('onboarding.title');
  let description = t('onboarding.loading');
  if (state.kind === 'unavailable') description = t('onboarding.loadError');
  if (ready) {
    if (complete) { heading = t('auth.oathTitle'); description = t('auth.oathPending'); }
    else if (basics) description = t('onboarding.unconfirmed');
    else if (!profile?.companionIntroduced) { heading = t('onboarding.companionTitle'); description = t('onboarding.companionPending'); }
    else if (profile.notificationPreference === null) { heading = t('onboarding.notificationsTitle'); description = t('onboarding.notificationsPending'); }
    else { heading = t('onboarding.reviewTitle'); description = t('onboarding.reviewPending'); }
  }
  const reason = ready && !isSupportedTimezone(ready.draft.timezone) ? t('onboarding.timezoneRequired')
    : ready && !ready.draft.intention ? t('onboarding.intentionRequired') : undefined;
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>{heading}</Text>
      <Text style={styles.body} accessibilityLiveRegion="polite">{description}</Text>
      {basics && ready && <>
        <View style={styles.group}>
          <Text style={styles.label}>{t('onboarding.language')}</Text>
          {(['pl', 'en'] as const).map(locale => <Pressable key={locale}
            accessibilityRole="radio" accessibilityLabel={t(`onboarding.language_${locale}`)}
            accessibilityState={{ selected: ready.draft.locale === locale, disabled: ready.busy }}
            disabled={ready.busy} onPress={() => { if (!ready.busy) onDraft({ locale }); }}
            style={[styles.choice, ready.draft.locale === locale && styles.selected]}
          ><Text style={styles.body}>{t(`onboarding.language_${locale}`)}</Text></Pressable>)}
        </View>
        <View style={styles.group}>
          <Text nativeID="onboarding-timezone-label" style={styles.label}>{t('onboarding.timezone')}</Text>
          <TextInput accessibilityLabel={t('onboarding.timezone')} accessibilityLabelledBy="onboarding-timezone-label"
            accessibilityHint={t('onboarding.timezoneExample')} value={ready.draft.timezone}
            onChangeText={timezone => { if (!ready.busy) onDraft({ timezone }); }} editable={!ready.busy}
            autoCapitalize="none" autoCorrect={false} maxLength={128} style={styles.input} />
          <Text style={styles.body}>{t('onboarding.timezoneExample')}</Text>
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={t('onboarding.intention')}
          accessibilityState={{ checked: ready.draft.intention, disabled: ready.busy }} disabled={ready.busy}
          onPress={() => { if (!ready.busy) onDraft({ intention: !ready.draft.intention }); }}
          style={[styles.choice, ready.draft.intention && styles.selected]}>
          <Text style={styles.body}>{t('onboarding.intention')}</Text>
          <Text style={styles.body}>{t(ready.draft.intention ? 'onboarding.checked' : 'onboarding.unchecked')}</Text>
        </Pressable>
        {ready.error && <Text accessibilityLiveRegion="polite" style={styles.body}>{t(`onboarding.error_${ready.error}`)}</Text>}
        {ready.error === 'load'
          ? <Action label={t('auth.retry')} onPress={onRetry} busy={ready.busy} />
          : <Action label={t('onboarding.confirm')} onPress={onSave} busy={ready.busy}
            {...(reason ? { disabled: true, unavailableReason: reason } : { disabled: false })} />}
      </>}
      {state.kind === 'unavailable' && <Action label={t('auth.retry')} onPress={onRetry} />}
      <Action label={t('auth.signOut')} onPress={onLogout} variant="secondary" />
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas },
  content: { flexGrow: 1, padding: tokens.space.card, gap: tokens.space.section },
  group: { gap: tokens.space.item },
  title: { color: tokens.color.text, fontSize: tokens.title, lineHeight: tokens.title * 1.2, fontWeight: '600' },
  label: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  choice: { minHeight: tokens.controlHeight, padding: tokens.space.item, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius, gap: tokens.space.small },
  selected: { backgroundColor: tokens.color.surface, borderColor: tokens.color.primary },
  input: { minHeight: tokens.controlHeight, padding: tokens.space.item, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius, color: tokens.color.text, fontSize: tokens.body },
});
