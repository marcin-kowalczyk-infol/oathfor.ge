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
  // A one-shot failure stays armed until the runtime spends it or a scenario resets the data.
  // Its line renders under its own button, read from the runtime state each time the controls render.
  const arm = (flag: 'loseNext' | 'loseNextProof' | 'loseNextRecordClear') => () => { dummy.state[flag] = true; repaint(value => value + 1); };
  type Control = { key: string; label: string; onPress: () => void; armed?: string | false };
  const scenarios: Control[] = [
    { key: 'new', label: copy.new, onPress: () => reset(false) },
    { key: 'empty', label: copy.empty, onPress: () => reset(true, false) },
    { key: 'returning', label: copy.returning, onPress: () => reset(true) },
  ];
  const failures: Control[] = [
    { key: 'offline', label: dummy.state.offline ? copy.online : copy.offline, onPress: () => { dummy.setOffline(!dummy.state.offline); repaint(value => value + 1); } },
    { key: 'expire', label: copy.expire, onPress: () => { dummy.state.expired = true; restart(); setControls(false); } },
    { key: 'lose', label: copy.lose, onPress: arm('loseNext'), armed: dummy.state.loseNext && copy.armed },
    { key: 'loseProof', label: copy.loseProof, onPress: arm('loseNextProof'), armed: dummy.state.loseNextProof && copy.proofArmed },
    { key: 'loseRecordClear', label: copy.loseRecordClear, onPress: arm('loseNextRecordClear'), armed: dummy.state.loseNextRecordClear && copy.recordClearArmed },
  ];
  const additions: Control[] = [
    { key: 'add', label: copy.add, onPress: () => { dummy.add(); repaint(value => value + 1); setControls(false); } },
    { key: 'addNeedsMore', label: copy.addNeedsMore, onPress: () => { dummy.addNeedsMore(); repaint(value => value + 1); setControls(false); } },
  ];
  const header = (text: string) => <Text accessibilityRole="header" style={styles.section}>{text}</Text>;
  const list = (controls: Control[]) => controls.map(({ key, label, onPress, armed }) => <View key={key} testID={`demo-control-${key}`} style={styles.group}>
    <Pressable accessibilityRole="button" style={[styles.button, armed ? styles.armed : null]} onPress={onPress}><Text style={styles.text}>{label}</Text></Pressable>
    {armed ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.armedText}>{armed}</Text> : null}
  </View>);
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
        {header(copy.sectionScenarios)}
        <Text style={styles.hint}>{copy.resetHint}</Text>
        {list(scenarios)}
        {header(copy.sectionLanguage)}
        <View style={styles.languages}>{(['pl', 'en'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: locale === value }} accessibilityLabel={value === 'pl' ? 'Polski' : 'English'} onPress={() => language(value)} style={[styles.button, locale === value ? styles.armed : null]}><Text style={styles.text}>{value.toUpperCase()}</Text></Pressable>)}</View>
        {header(copy.sectionFailures)}
        {list(failures)}
        {header(copy.sectionAdd)}
        <Text style={styles.hint}>{copy.addHint}</Text>
        {list(additions)}
        {header(copy.sectionTools)}
        {list([{ key: 'restart', label: copy.restart, onPress: () => { restart(); setControls(false); } }])}
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: dummy.state.wireCheck }} accessibilityLabel={copy.wireCheck} style={styles.button} onPress={() => { dummy.state.wireCheck = !dummy.state.wireCheck; repaint(value => value + 1); }}>
          <Text style={styles.text}>{copy.wireCheck} · {dummy.state.wireCheck ? copy.wireCheckOn : copy.wireCheckOff}</Text>
        </Pressable>
        {dummy.state.wireCheck && <Text style={styles.text}>{copy.wireCheckNotice} {WIRE_CHECK_BASE_URL}</Text>}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setControls(false)}><Text style={styles.text}>{copy.close}</Text></Pressable>
      </ScrollView></SafeAreaView></SafeAreaProvider>
    </Modal>
  </View></SafeAreaProvider>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#15191c' }, product: { flex: 1, overflow: 'hidden' }, badge: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 16 }, badgeText: { color: '#ffd380', fontSize: 12 }, controls: { padding: 20, gap: 12 }, section: { color: '#ffd380', fontSize: 18, fontWeight: '700', marginTop: 10 }, hint: { color: '#c9c2b4', fontSize: 14 }, group: { gap: 6 }, armed: { backgroundColor: '#3d3220' }, armedText: { color: '#ffd380', fontSize: 15 }, languages: { flexDirection: 'row', gap: 12 }, title: { color: '#ffd380', fontSize: 26, fontWeight: '700' }, text: { color: '#fff', fontSize: 16 }, button: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#ffd380', borderRadius: 12, padding: 12 } });
