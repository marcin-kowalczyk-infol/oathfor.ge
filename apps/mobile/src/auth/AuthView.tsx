import * as AppleAuthentication from 'expo-apple-authentication';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import type { SessionState } from './session';

export type AuthViewProps = {
  state: SessionState;
  availability: 'checking' | 'available' | 'unavailable';
  onLogin: () => void;
  onRetry: () => void;
  onLogout: () => void;
};

export function AuthView({ state, availability, onLogin, onRetry, onLogout }: AuthViewProps) {
  const { t, i18n } = useTranslation();
  // Drawn Polish prose keeps a single-letter word with the next word.
  const prose = (value: string) => bindShortWords(value, i18n.language);
  let heading = t('auth.signInTitle');
  let description: string;
  let error: string | undefined;
  let retry = false;
  let logout = false;
  if (state.kind === 'authenticated') {
    const onboarding = state.account.onboardingStatus === 'pending';
    heading = t(onboarding ? 'auth.onboardingTitle' : 'auth.oathTitle');
    description = t(onboarding ? 'auth.onboardingPending' : 'auth.oathPending');
    logout = true;
  } else if (state.kind === 'signed_out') {
    description = t(availability === 'checking' ? 'auth.checkingApple' : availability === 'unavailable' ? 'auth.appleUnavailable' : 'auth.signInDescription');
    retry = availability === 'unavailable';
    if (state.error && state.error.kind !== 'cancelled') {
      switch (state.error.kind) {
        case 'reauthenticate': error = t('auth.reauthenticate'); break;
        case 'fresh_challenge': error = t('auth.freshChallenge'); break;
        case 'rate_limited': error = t('auth.rateLimited', { count: state.error.retryAfterSeconds }); break;
        case 'configuration': error = t('auth.configuration'); break;
        default: error = t('auth.loginUnavailable');
      }
    }
  } else if (state.kind === 'cleanup_required') {
    heading = t('auth.cleanupTitle');
    description = t(state.serverRevoked ? 'auth.cleanupConfirmed' : 'auth.cleanupUnconfirmed');
    retry = true;
  } else if (state.kind === 'revocation_pending') {
    heading = t('auth.signOutPendingTitle');
    description = t('auth.signOutPending');
    retry = true;
  } else {
    description = t(`auth.${state.kind}`);
    retry = state.kind === 'verification_unavailable';
    logout = state.kind === 'validating' || state.kind === 'verification_unavailable';
  }
  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{prose(heading)}</Text>
      {/* An error after the player's own sign-in replaces the description (docs/product/clarity.md decision 3).
          While Apple sign-in is unavailable that reason stays, because it explains the missing button. */}
      <View style={styles.status} accessibilityLiveRegion="polite">
        {error && availability === 'available' ? <Text accessibilityRole="alert" style={styles.body}>{prose(error)}</Text> : <Text style={styles.body}>{prose(description)}</Text>}
      </View>
      {state.kind === 'signed_out' && availability === 'available' && <AppleAuthentication.AppleAuthenticationButton
        testID="native-apple-button"
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={tokens.radius}
        style={styles.appleButton}
        onPress={onLogin}
      />}
      {retry && <Action label={t('auth.retry')} onPress={onRetry} />}
      {state.kind === 'authenticating' && <Action label={t('auth.cancelSignIn')} onPress={onLogout} variant="secondary" />}
      {logout && <Action label={t('auth.signOut')} onPress={onLogout} variant="secondary" />}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas },
  content: { flexGrow: 1, padding: tokens.space.card, gap: tokens.space.section },
  title: { color: tokens.color.text, fontSize: tokens.title, lineHeight: tokens.title * 1.2, fontWeight: '600' },
  status: { gap: tokens.space.item },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  appleButton: { width: '100%', height: tokens.controlHeight },
});
