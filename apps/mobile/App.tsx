import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { checkHealth } from './src/api/health';
import { copy } from './src/diagnostics/copy';

export default function App() {
  const [state, setState] = useState<'pending' | 'success' | 'error'>('pending');
  const [attempt, setAttempt] = useState(0);
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  const text = copy[process.env.EXPO_PUBLIC_DIAGNOSTIC_LOCALE === 'en' ? 'en' : 'pl'];

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
      <Text accessibilityLiveRegion="polite" style={styles.message}>{text[state]}</Text>
      {state === 'error' && (
        <Pressable accessibilityRole="button" accessibilityLabel={text.retry} onPress={() => setAttempt((value) => value + 1)} style={styles.button}>
          <Text style={styles.buttonText}>{text.retry}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191d21', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 },
  button: { minHeight: 48, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: '#edce8a', borderRadius: 8 },
  buttonText: { color: '#191d21', fontSize: 18, fontWeight: '600' },
  heading: { color: '#fff', fontSize: 32, fontWeight: '700' },
  message: { color: '#f1eadb', fontSize: 18, textAlign: 'center' },
});
