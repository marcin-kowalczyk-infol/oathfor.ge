import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Oath } from '../api/oathSchema';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { tokens } from '../ui/tokens';
import { storedTime } from './SnapshotRules';

const symbols = { running: '↟', strength_training: '◆', mobility: '≈' };

/** Decoration never observes time, changes Oath state or awards progression. */
export function ForgeHub({ items, onOpen }: { items: Oath[]; onOpen(id: string): void }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { fontScale, width } = useWindowDimensions();
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const glow = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    if (reduced || !foreground) { glow.setValue(0.18); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.35, duration: 2600, useNativeDriver: true, isInteraction: false }),
      Animated.timing(glow, { toValue: 0.18, duration: 2600, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [reduced, foreground, glow]);
  // The full ordered list immediately below provides the equivalent large-type interface.
  if (fontScale > 1.3 || width < 350) return null;
  return <View style={styles.hub}>
    <View style={styles.art} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.orbit} />
      <Image source={require('../../assets/forge/hearth-v01.png')} style={styles.image} resizeMode="contain" />
      <Animated.View style={[styles.glow, { opacity: glow }]} />
    </View>
    {items.length > 0 && <>
      <Text accessibilityRole="header" style={styles.caption}>{t('forge.seals')}</Text>
      <View style={styles.seals}>{items.slice(0, 3).map(item => {
        const copy = item.snapshot.copy[locale];
        const deadline = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(`${item.snapshot.deadline.local}Z`));
        return <View key={item.id} style={styles.branch}>
          <View style={styles.connection} accessible={false} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('forge.seal', { activity: copy.activity, state: t(`oath.states.${item.state}`), deadline: storedTime(item.snapshot.deadline, locale) })}
            onPress={() => onOpen(item.id)} style={({ pressed }) => [styles.seal, pressed && styles.pressed]}>
            <Text style={styles.symbol} accessible={false}>{symbols[item.snapshot.activity]}</Text>
            <Text style={styles.name}>{copy.activity}</Text>
            <Text style={styles.state}>{t(`oath.states.${item.state}`)} · {deadline}</Text>
          </Pressable>
        </View>;
      })}</View>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  hub: { gap: 8 }, art: { height: 242, alignItems: 'center', justifyContent: 'center' },
  image: { width: 242, height: 242, borderRadius: 100 },
  orbit: { position: 'absolute', width: 270, height: 188, borderRadius: 140, borderWidth: 1, borderColor: '#534331', transform: [{ rotate: '-12deg' }] },
  glow: { position: 'absolute', width: 38, height: 25, borderRadius: 20, backgroundColor: '#ffa334', top: 144, pointerEvents: 'none' },
  caption: { color: tokens.color.secondary, fontSize: 15, textAlign: 'center' },
  seals: { flexDirection: 'row', gap: 8 }, branch: { flex: 1, alignItems: 'center' },
  connection: { height: 14, width: 1, backgroundColor: '#756044' },
  seal: { alignSelf: 'stretch', flex: 1, alignItems: 'center', gap: 6, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#665039', backgroundColor: '#202326', minHeight: 48 },
  pressed: { backgroundColor: '#3a3025', borderColor: tokens.color.primary },
  symbol: { color: tokens.color.primary, fontSize: 24 }, name: { color: tokens.color.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  state: { color: tokens.color.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
