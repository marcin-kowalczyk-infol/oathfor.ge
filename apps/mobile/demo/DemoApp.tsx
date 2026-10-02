import { useEffect, useState } from 'react';
import { Modal, ScrollView, View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { Text } from '../src/ui/Text';
import { AuthScreen } from '../src/auth/AuthScreen';
import { LocalizationProvider } from '../src/localization/LocalizationProvider';
import type { Locale } from '../src/localization/locale';
import { createDummy } from './runtime';
import { WIRE_CHECK_BASE_URL } from './wireCheck';
import en from './locales/en.json';
import pl from './locales/pl.json';

type Dummy = ReturnType<typeof createDummy>;
function Run({ dummy, locale }: { dummy: Dummy; locale: Locale }) {
  // Creation and disposal share one effect. Re-run effects (Fast Refresh, StrictMode) get a live runtime.
  const [runtime, setRuntime] = useState<ReturnType<Dummy['runtime']> | null>(null);
  useEffect(() => {
    const next = dummy.runtime();
    setRuntime(next);
    return () => next.controller.dispose();
  }, [dummy]);
  if (!runtime) return null;
  return <LocalizationProvider initialLocale={locale}><AuthScreen {...runtime} /></LocalizationProvider>;
}
// The app owns the menu, the Forge room and its guide. The demo only adds DUMMY data and its controls.
export default function DemoApp() {
  const [locale, setLocale] = useState<Locale>('pl');
  const { fontScale } = useWindowDimensions();
  const [dummy, setDummy] = useState(() => createDummy('pl', true, false));
  const [mount, setMount] = useState(0);
  const [controls, setControls] = useState(false);
  const [, repaint] = useState(0);
  const copy = locale === 'pl' ? pl : en;
  const restart = () => setMount(value => value + 1);
  function reset(complete: boolean, populated = complete) {
    const next = createDummy(locale, complete, populated);
    // The wire check is a transport setting, not scenario data, so a scenario keeps it.
    next.state.wireCheck = dummy.state.wireCheck;
    setDummy(next); restart(); setControls(false);
  }
  function language(next: Locale) { dummy.state.profile.profile.locale = next; setLocale(next); restart(); }
  const buttons: [string, () => void][] = [
    [copy.new, () => reset(false)], [copy.empty, () => reset(true, false)], [copy.returning, () => reset(true)],
    [copy.restart, () => { restart(); setControls(false); }],
    [copy.expire, () => { dummy.state.expired = true; restart(); setControls(false); }],
    [dummy.state.offline ? copy.online : copy.offline, () => { dummy.setOffline(!dummy.state.offline); repaint(value => value + 1); }],
    [copy.lose, () => { dummy.state.loseNext = true; repaint(value => value + 1); }],
    [copy.loseProof, () => { dummy.state.loseNextProof = true; repaint(value => value + 1); }],
    [copy.loseRecordClear, () => { dummy.state.loseNextRecordClear = true; repaint(value => value + 1); }],
    [copy.add, () => { dummy.add(); repaint(value => value + 1); setControls(false); }],
    [copy.addNeedsMore, () => { dummy.addNeedsMore(); repaint(value => value + 1); setControls(false); }],
  ];
  // The bar keeps the top inset. The product gets its own provider, which on a device starts under the bar,
  // so the product screens get no second top inset. A Modal needs its own provider too.
  // Initial metrics let the first frame render before the native insets arrive.
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><View style={styles.root}>
    <SafeAreaView testID="demo-badge-bar" edges={['top', 'left', 'right']}><Pressable accessibilityRole="button" accessibilityLabel={copy.badge} onPress={() => setControls(true)} style={styles.badge}><Text key={fontScale} maxFontSizeMultiplier={1.4} style={styles.badgeText}>{copy.badge}{dummy.state.offline ? ' · OFFLINE' : ''}</Text></Pressable></SafeAreaView>
    <SafeAreaProvider style={styles.product}><Run key={mount} dummy={dummy} locale={locale} /></SafeAreaProvider>
    <Modal visible={controls} animationType="none" onRequestClose={() => setControls(false)}>
      <SafeAreaProvider><SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.controls}>
        <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
        <Text style={styles.text}>{copy.notice}</Text>
        <View style={styles.languages}>{(['pl', 'en'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: locale === value }} accessibilityLabel={value === 'pl' ? 'Polski' : 'English'} onPress={() => language(value)} style={styles.button}><Text style={styles.text}>{value.toUpperCase()}</Text></Pressable>)}</View>
        <Text style={styles.text}>{copy.resetHint}</Text>
        {buttons.map(([label, action]) => <Pressable key={label} accessibilityRole="button" style={styles.button} onPress={action}><Text style={styles.text}>{label}</Text></Pressable>)}
        {dummy.state.loseNext && <Text accessibilityRole="alert" style={styles.text}>{copy.armed}</Text>}
        {dummy.state.loseNextProof && <Text accessibilityRole="alert" style={styles.text}>{copy.proofArmed}</Text>}
        {dummy.state.loseNextRecordClear && <Text accessibilityRole="alert" style={styles.text}>{copy.recordClearArmed}</Text>}
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: dummy.state.wireCheck }} accessibilityLabel={copy.wireCheck} style={styles.button} onPress={() => { dummy.state.wireCheck = !dummy.state.wireCheck; repaint(value => value + 1); }}>
          <Text style={styles.text}>{copy.wireCheck} · {dummy.state.wireCheck ? copy.wireCheckOn : copy.wireCheckOff}</Text>
        </Pressable>
        {dummy.state.wireCheck && <Text style={styles.text}>{copy.wireCheckNotice} {WIRE_CHECK_BASE_URL}</Text>}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setControls(false)}><Text style={styles.text}>{copy.close}</Text></Pressable>
      </ScrollView></SafeAreaView></SafeAreaProvider>
    </Modal>
  </View></SafeAreaProvider>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#15191c' }, product: { flex: 1, overflow: 'hidden' }, badge: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 16 }, badgeText: { color: '#ffd380', fontSize: 12 }, controls: { padding: 20, gap: 14 }, languages: { flexDirection: 'row', gap: 12 }, title: { color: '#ffd380', fontSize: 26, fontWeight: '700' }, text: { color: '#fff', fontSize: 16 }, button: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#ffd380', borderRadius: 12, padding: 12 } });
