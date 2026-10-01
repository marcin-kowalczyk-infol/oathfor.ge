import { Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../ui/Text';
import { isSupportedTimezone } from '../api/profile';
import { useTranslation } from '../localization/LocalizationProvider';
import { CompanionArt } from '../companion/CompanionProgress';
import { NotificationView, type NotificationViewProps } from './NotificationView';
import { Action } from '../ui/Action';
import { CompanionBubble } from '../ui/CompanionBubble';
import { tokens } from '../ui/tokens';
import type { BasicsDraft, OnboardingState } from './controller';

export type OnboardingViewProps = {
  state: OnboardingState;
  notifications?: Omit<NotificationViewProps, 'preference'>;
  onDraft: (patch: Partial<BasicsDraft>) => void;
  onSave: () => void;
  onIntroduce: () => void;
  onComplete?: () => void;
  onRetry: () => void;
  onLogout: () => void;
};
export function OnboardingView({ state, onDraft, onSave, onIntroduce, onComplete, onRetry, onLogout, notifications }: OnboardingViewProps) {
  const { t } = useTranslation();
  const ready = state.kind === 'ready' ? state : undefined;
  const profile = ready?.value.profile;
  const complete = ready?.value.onboardingStatus === 'complete';
  const basics = ready && !complete && (!profile?.locale || !isSupportedTimezone(profile.timezone) || !profile.intention);
  const introduction = ready && !complete && !basics && !profile?.companionIntroduced;
  const review = ready && !complete && !basics && !introduction && profile?.notificationPreference !== null;
  let heading = t('onboarding.title');
  let description = t('onboarding.loading');
  if (state.kind === 'unavailable') description = t('onboarding.loadError');
  if (ready) {
    if (complete) { heading = t('onboarding.trialTitle'); description = t('onboarding.trialPending'); }
    else if (basics) description = t('onboarding.unconfirmed');
    // Żaromir introduces himself in his own bubble above Dalej, so the plain description stays empty here.
    else if (!profile?.companionIntroduced) { heading = t('onboarding.companionTitle'); description = ''; }
    else if (profile.notificationPreference === null) { heading = t('onboarding.notificationsTitle'); description = t('onboarding.notificationsPending'); }
    else { heading = t('onboarding.reviewTitle'); description = t('onboarding.reviewPending'); }
  }
  // One plain line at a time (docs/product/clarity.md decision 14, the pause review pattern): an error after the player's own
  // action replaces the step's line as an alert instead of stacking under it (MVP-22-A4b).
  const notificationError = notifications?.state.error;
  let error: string | undefined;
  if (ready?.error && basics) error = t(`onboarding.error_${ready.error}`);
  else if (ready?.error && introduction) error = t('onboarding.introductionError');
  else if (ready?.error && review) error = t(ready.error === 'load' ? 'onboarding.completionLoadError' : 'onboarding.error_complete');
  else if (ready && !complete && !basics && !introduction && notificationError) error = t(`notifications.error_${notificationError}`);
  const reason = ready && !isSupportedTimezone(ready.draft.timezone) ? t('onboarding.timezoneRequired')
    : ready && !ready.draft.intention ? t('onboarding.intentionRequired') : undefined;
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>{heading}</Text>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{error}</Text>
        : description !== '' && <Text style={styles.body} accessibilityLiveRegion="polite">{description}</Text>}
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
        {ready.error === 'load'
          ? <Action label={t('auth.retry')} onPress={onRetry} busy={ready.busy} />
          : <Action label={t('onboarding.confirm')} onPress={onSave} busy={ready.busy}
            {...(reason ? { disabled: true, unavailableReason: reason } : { disabled: false })} />}
      </>}
      {introduction && ready && <>
        {!ready.error && <View accessibilityLiveRegion="polite"><CompanionBubble message={t('onboarding.companionIntroduction')} /></View>}
        <Action label={t(ready.error ? 'auth.retry' : 'onboarding.continue')}
          onPress={ready.error === 'load' ? onRetry : onIntroduce} busy={ready.busy} />
        <CompanionArt appearance="zharomir-wanderer-v01" decorative />
      </>}
      {review && profile && <View style={styles.group}>
        <Text style={styles.body}>{t('onboarding.reviewLanguage', { language: t(`onboarding.language_${profile.locale}`) })}</Text>
        <Text style={styles.body}>{t('onboarding.reviewTimezone', { timezone: profile.timezone })}</Text>
        <Text style={styles.body}>{t('onboarding.reviewIntention')}</Text>
        <Text style={styles.body}>{t('onboarding.reviewCompanion')}</Text>
      </View>}
      {ready && profile && !complete && !basics && !introduction && notifications && <NotificationView {...notifications}
        state={{ ...notifications.state, busy: ready.busy || notifications.state.busy, error: undefined }} preference={profile.notificationPreference} />}
      {review && ready && <>
        {onComplete && <Action label={t(ready.error ? 'auth.retry' : 'onboarding.continue')}
          onPress={ready.error === 'load' ? onRetry : onComplete} busy={ready.busy || notifications?.state.busy === true} />}
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
  // The error box of Settings and the pause review.
  notice: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217,163,144,0.5)',
    backgroundColor: 'rgba(217,163,144,0.08)', padding: 12, overflow: 'hidden' },
  choice: { minHeight: tokens.controlHeight, padding: tokens.space.item, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius, gap: tokens.space.small },
  selected: { backgroundColor: tokens.color.surface, borderColor: tokens.color.primary },
  input: { minHeight: tokens.controlHeight, padding: tokens.space.item, borderWidth: 1, borderColor: tokens.color.neutral, borderRadius: tokens.radius, color: tokens.color.text, fontSize: tokens.body },
});
