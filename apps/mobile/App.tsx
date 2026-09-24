import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Action } from './src/ui/Action';
import { AuthScreen } from './src/auth/AuthScreen';
import { getSessionRuntime } from './src/auth/runtime';
import { checkHealth } from './src/api/health';
import { LocalizationProvider, useTranslation } from './src/localization/LocalizationProvider';

export function DiagnosticScreen() {
  const [state, setState] = useState<'pending' | 'success' | 'error'>('pending');
  const [attempt, setAttempt] = useState(0);
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  const { t } = useTranslation();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => {
      active = false;
      controller.abort();
      setState('error');
    }, 8000);
    setState('pending');
    checkHealth(baseUrl, controller.signal).then(
      () => { clearTimeout(timeout); if (active) setState('success'); },
      () => { clearTimeout(timeout); if (active) setState('error'); },
    );
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [baseUrl, attempt]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text accessibilityRole="header" style={styles.heading}>Oathforge</Text>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{t(`diagnostics.${state}`)}</Text>
      {state === 'error' && (
        <Action label={t('diagnostics.retry')} onPress={() => setAttempt((value) => value + 1)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191d21', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 },
  heading: { color: '#fff', fontSize: 32, fontWeight: '700' },
  message: { color: '#f1eadb', fontSize: 18, textAlign: 'center' },
});

export default function App() {
  if (__DEV__ && process.env.EXPO_PUBLIC_DIAGNOSTIC_MODE === 'true') {
    const override = process.env.EXPO_PUBLIC_DIAGNOSTIC_LOCALE;
    return <LocalizationProvider initialLocale={override === 'pl' || override === 'en' ? override : undefined}>
      <DiagnosticScreen />
    </LocalizationProvider>;
  }
  return <LocalizationProvider><AuthScreen {...getSessionRuntime()} /></LocalizationProvider>;
}
