import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { Action } from '../ui/Action';
import { tokens } from '../ui/tokens';
import type { CharacterControllerState } from './controller';

/** Loading and failure states before the app knows the account's characters. Never shows creation. */
export function CharacterStatusView({ state, onRetry, onLogout }: { state: Exclude<CharacterControllerState, { kind: 'ready' }>; onRetry(): void; onLogout(): void }) {
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const failed = state.kind === 'unavailable' || state.kind === 'storage_unavailable';
  const message = state.kind === 'storage_unavailable' ? t('character.storageUnavailable')
    : state.kind === 'unavailable' ? t('character.error.unavailable') : t('character.loading');
  return <SafeAreaView style={styles.root}>
    <ScrollView key={fontScale} contentContainerStyle={styles.content}>
      <Text accessibilityLiveRegion="polite" accessibilityRole={failed ? 'alert' : undefined} style={styles.message}>{bindShortWords(message, i18n.language)}</Text>
      {failed && <View style={styles.actions}>
        <Action label={t('character.retry')} onPress={onRetry} />
        <Action variant="secondary" label={t('auth.signOut')} onPress={onLogout} />
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1012' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 24 },
  message: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, textAlign: 'center' },
  actions: { gap: 12 },
});
