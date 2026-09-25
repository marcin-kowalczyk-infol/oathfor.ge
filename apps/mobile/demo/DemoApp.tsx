import { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { AuthScreen } from '../src/auth/AuthScreen';
import { LocalizationProvider } from '../src/localization/LocalizationProvider';
import type { Locale } from '../src/localization/locale';
import { createDummy } from './runtime';
import { ForgeScene } from './ForgeScene';
import en from './locales/en.json';
import pl from './locales/pl.json';

type Dummy = ReturnType<typeof createDummy>;
function Run({ dummy, locale }: { dummy: Dummy; locale: Locale }) {
  const [runtime] = useState(() => dummy.runtime());
  useEffect(() => () => runtime.controller.dispose(), [runtime]);
  return <LocalizationProvider initialLocale={locale}><AuthScreen {...runtime} /></LocalizationProvider>;
}
export default function DemoApp() {
  const [locale, setLocale] = useState<Locale>('pl');
  const [dummy, setDummy] = useState(() => createDummy('pl', true, false));
  const [mount, setMount] = useState(0);
  const [controls, setControls] = useState(false);
  const [scene, setScene] = useState(true);
  const [, repaint] = useState(0);
  const copy = locale === 'pl' ? pl : en;
  const restart = () => setMount(value => value + 1);
  function reset(complete: boolean, populated = complete) { setDummy(createDummy(locale, complete, populated)); restart(); setScene(false); setControls(false); }
  function language(next: Locale) { dummy.state.profile.profile.locale = next; setLocale(next); restart(); }
  const buttons: [string, () => void][] = [
    [copy.sceneOpen, () => { setScene(true); setControls(false); }],
    [copy.new, () => reset(false)], [copy.empty, () => reset(true, false)], [copy.returning, () => reset(true)],
    [copy.restart, () => { restart(); setControls(false); }],
    [copy.expire, () => { dummy.state.expired = true; restart(); setControls(false); }],
    [dummy.state.offline ? copy.online : copy.offline, () => { dummy.state.offline = !dummy.state.offline; repaint(value => value + 1); }],
    [copy.lose, () => { dummy.state.loseNext = true; repaint(value => value + 1); }],
    [copy.add, () => { dummy.add(); repaint(value => value + 1); setControls(false); }],
  ];
  return <SafeAreaView style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel={copy.badge} onPress={() => setControls(true)} style={styles.badge}><Text style={styles.badgeText}>{copy.badge}{dummy.state.offline ? ' · OFFLINE' : ''}</Text></Pressable>
    <View style={styles.product}>{scene ? <ForgeScene locale={locale} onExit={() => setScene(false)} /> : <Run key={mount} dummy={dummy} locale={locale} />}</View>
    <Modal visible={controls} animationType="none" onRequestClose={() => setControls(false)}>
      <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.controls}>
        <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
        <Text style={styles.text}>{copy.notice}</Text>
        <View style={styles.languages}>{(['pl', 'en'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: locale === value }} accessibilityLabel={value === 'pl' ? 'Polski' : 'English'} onPress={() => language(value)} style={styles.button}><Text style={styles.text}>{value.toUpperCase()}</Text></Pressable>)}</View>
        <Text style={styles.text}>{copy.resetHint}</Text>
        {buttons.map(([label, action]) => <Pressable key={label} accessibilityRole="button" style={styles.button} onPress={action}><Text style={styles.text}>{label}</Text></Pressable>)}
        {dummy.state.loseNext && <Text accessibilityRole="alert" style={styles.text}>{copy.armed}</Text>}
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setControls(false)}><Text style={styles.text}>{copy.close}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#15191c' }, product: { flex: 1 }, badge: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 16 }, badgeText: { color: '#ffd380', fontSize: 12 }, controls: { padding: 20, gap: 14 }, languages: { flexDirection: 'row', gap: 12 }, title: { color: '#ffd380', fontSize: 26, fontWeight: '700' }, text: { color: '#fff', fontSize: 16 }, button: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#ffd380', borderRadius: 12, padding: 12 } });
