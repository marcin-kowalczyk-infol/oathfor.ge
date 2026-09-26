import { Fragment, useEffect, useRef, useState } from 'react';
import { StatusBar, Modal, SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import type { ForgeNavigation } from '../src/oaths/OathHomeScreen';
import { AuthScreen } from '../src/auth/AuthScreen';
import { LocalizationProvider } from '../src/localization/LocalizationProvider';
import type { Locale } from '../src/localization/locale';
import { I18nextProvider } from 'react-i18next';
import { createTranslation } from '../src/localization/createTranslation';
import { createDummy } from './runtime';
import { ForgeRoom } from '../src/forge/ForgeRoom';
import { MotionSuspended } from '../src/ui/useMotion';
import en from './locales/en.json';
import pl from './locales/pl.json';

type Dummy = ReturnType<typeof createDummy>;
function Run({ dummy, locale, forgeNavigation }: { dummy: Dummy; locale: Locale; forgeNavigation: ForgeNavigation }) {
  // Creation and disposal share one effect. Re-run effects (Fast Refresh, StrictMode) get a live runtime.
  const [runtime, setRuntime] = useState<ReturnType<Dummy['runtime']> | null>(null);
  useEffect(() => {
    const next = dummy.runtime();
    setRuntime(next);
    return () => next.controller.dispose();
  }, [dummy]);
  if (!runtime) return null;
  return <LocalizationProvider initialLocale={locale}><AuthScreen {...runtime} forgeNavigation={forgeNavigation} /></LocalizationProvider>;
}
export default function DemoApp() {
  const [locale, setLocale] = useState<Locale>('pl');
  // The room keeps its state across a language change, as the demo scene did before it moved into the app.
  const [roomTranslation] = useState(() => createTranslation('pl'));
  const { fontScale } = useWindowDimensions();
  const [dummy, setDummy] = useState(() => createDummy('pl', true, false));
  const [mount, setMount] = useState(0);
  const [controls, setControls] = useState(false);
  // A remounted functional app starts at its own Today and must not replay an earlier room destination.
  const requestSeq = useRef(0);
  const [request, setRequest] = useState<ForgeNavigation['request']>(null);
  function openStation(station: 'hearth' | 'seals' | 'chronicle') {
    setRequest({ id: ++requestSeq.current, target: station === 'hearth' ? 'create' : station === 'seals' ? 'today' : 'history' });
    setScene(false);
  }
  const [scene, setScene] = useState(true);
  const [introSeen, setIntroSeen] = useState(false);
  const [guideRun, setGuideRun] = useState(0);
  const [, repaint] = useState(0);
  const copy = locale === 'pl' ? pl : en;
  const restart = () => { setRequest(null); setMount(value => value + 1); };
  function reset(complete: boolean, populated = complete) { setDummy(createDummy(locale, complete, populated)); setIntroSeen(false); restart(); setScene(false); setControls(false); }
  function language(next: Locale) { dummy.state.profile.profile.locale = next; void roomTranslation.changeLanguage(next); setLocale(next); restart(); }
  const buttons: [string, () => void][] = [
    [copy.sceneOpen, () => { setScene(true); setControls(false); }],
    [copy.sceneGuide, () => { setIntroSeen(false); setGuideRun(value => value + 1); setScene(true); setControls(false); }],
    [copy.new, () => reset(false)], [copy.empty, () => reset(true, false)], [copy.returning, () => reset(true)],
    [copy.restart, () => { restart(); setControls(false); }],
    [copy.expire, () => { dummy.state.expired = true; restart(); setControls(false); }],
    [dummy.state.offline ? copy.online : copy.offline, () => { dummy.state.offline = !dummy.state.offline; repaint(value => value + 1); }],
    [copy.lose, () => { dummy.state.loseNext = true; repaint(value => value + 1); }],
    [copy.add, () => { dummy.add(); repaint(value => value + 1); setControls(false); }],
  ];
  const Root = View;
  const BadgeFrame = scene ? Fragment : SafeAreaView;
  return <Root style={styles.root}>
    <StatusBar hidden={scene} />
    {/* The room is fullscreen, while functional screens keep the badge below the status bar. */}
    <BadgeFrame><Pressable accessibilityRole="button" accessibilityLabel={copy.badge} onPress={() => setControls(true)} style={[styles.badge, scene && styles.sceneBadge]}><Text key={fontScale} allowFontScaling={!scene} maxFontSizeMultiplier={1.4} style={styles.badgeText}>{scene ? 'DEMO' : copy.badge}{dummy.state.offline ? ' · OFFLINE' : ''}</Text></Pressable></BadgeFrame>
    <View style={styles.product}><View style={[styles.product, scene && styles.hidden]} accessibilityElementsHidden={scene} importantForAccessibility={scene ? 'no-hide-descendants' : 'auto'} pointerEvents={scene ? 'none' : 'auto'}><MotionSuspended suspended={scene}><Run key={mount} dummy={dummy} locale={locale} forgeNavigation={{ request, onReturn: () => setScene(true) }} /></MotionSuspended></View>{scene && <I18nextProvider i18n={roomTranslation}><ForgeRoom key={guideRun} showGuide={!introSeen} onGuideComplete={() => setIntroSeen(true)} onExit={() => openStation('seals')} onOpenStation={openStation} /></I18nextProvider>}</View>
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
  </Root>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#15191c' }, product: { flex: 1 }, hidden: { display: 'none' }, sceneBadge: { position: 'absolute', top: 54, left: 12, zIndex: 10, backgroundColor: '#15191c88', borderRadius: 18 }, badge: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 16 }, badgeText: { color: '#ffd380', fontSize: 12 }, controls: { padding: 20, gap: 14 }, languages: { flexDirection: 'row', gap: 12 }, title: { color: '#ffd380', fontSize: 26, fontWeight: '700' }, text: { color: '#fff', fontSize: 16 }, button: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#ffd380', borderRadius: 12, padding: 12 } });
