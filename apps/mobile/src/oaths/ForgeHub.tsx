import { useEffect, useRef } from 'react';
import { CountdownChip } from './CountdownChip';
import type { ServerClock } from './serverClock';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Oath } from '../api/oathSchema';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { tokens } from '../ui/tokens';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { StateSeal } from '../ui/StateSeal';
import { useMotionAllowed } from '../ui/useMotion';
import { storedTime } from './SnapshotRules';

const embers = [{ x: -35, y: 5, size: 3 }, { x: 17, y: 22, size: 4 }, { x: -8, y: 40, size: 2 }, { x: 36, y: 57, size: 3 }];

function Seal({ item, onOpen, motion, clock, onElapsed }: { item: Oath; onOpen(id: string): void; motion: boolean; clock?: ServerClock; onElapsed?(): void }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!motion) { scale.stopAnimation(); scale.setValue(1); }
    return () => scale.stopAnimation();
  }, [motion, scale]);
  const press = (down: boolean) => {
    scale.stopAnimation();
    if (motion) Animated.spring(scale, { toValue: down ? 0.9 : 1, speed: 24, bounciness: down ? 0 : 10, useNativeDriver: true }).start();
  };
  const copy = item.snapshot.copy[locale];
  const deadline = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(`${item.snapshot.deadline.local}Z`));
  return <View style={styles.branch}>
    <Pressable testID="forge-seal" accessibilityRole="button" accessibilityLabel={t('forge.seal', { activity: copy.activity, state: t(`oath.states.${item.state}`), deadline: storedTime(item.snapshot.deadline, locale) })}
      onPress={() => onOpen(item.id)} onPressIn={() => press(true)} onPressOut={() => press(false)} style={styles.sealTarget}>
      {({ pressed }) => <>
        <Animated.View style={{ transform: [{ scale }], opacity: pressed ? 0.8 : 1 }} accessible={false}>
          <ActivityEmblem activity={item.snapshot.activity} size={82} />
          <View style={styles.stateBadge}><StateSeal state={item.state} size={34} /></View>
        </Animated.View>
        <Text style={[styles.name, pressed && styles.highlight]}>{copy.activity}</Text>
        <Text style={styles.state}>{t(`oath.states.${item.state}`)}</Text>
        <Text style={styles.deadline}>{deadline}</Text>
        {clock && <View style={styles.chip}><CountdownChip oath={item} clock={clock} onElapsed={onElapsed} /></View>}
      </>}
    </Pressable>
  </View>;
}

/** Atmosphere never observes deadlines, changes Oath state or awards progression. */
export function ForgeHub({ items, onOpen, onCreate, createDisabled = false, clock, onElapsed }: {
  items: Oath[]; onOpen(id: string): void; onCreate?: () => void; createDisabled?: boolean;
  /** Server time for the countdown chips. A chip reaching zero asks the owner for a fresh list, it never changes state. */
  clock?: ServerClock; onElapsed?(): void;
}) {
  const { t } = useTranslation();
  const { fontScale, width } = useWindowDimensions();
  const motion = useMotionAllowed();
  const glow = useRef(new Animated.Value(0.18)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const hearthScale = useRef(new Animated.Value(1)).current;
  const visible = fontScale <= 1.3 && width >= 350;
  useEffect(() => {
    if (!motion || !visible) { glow.setValue(0.18); drift.setValue(0); hearthScale.stopAnimation(); hearthScale.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.5, duration: 2100, useNativeDriver: true, isInteraction: false }),
      Animated.timing(glow, { toValue: 0.18, duration: 2900, useNativeDriver: true, isInteraction: false }),
    ]));
    const sparks = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 4400, useNativeDriver: true, isInteraction: false }));
    animation.start(); sparks.start();
    return () => { animation.stop(); sparks.stop(); hearthScale.stopAnimation(); };
  }, [motion, visible, glow, drift, hearthScale]);
  const pressHearth = (down: boolean) => {
    hearthScale.stopAnimation();
    if (motion) Animated.spring(hearthScale, { toValue: down ? 0.96 : 1, speed: 22, bounciness: down ? 0 : 8, useNativeDriver: true }).start();
  };
  // Parent supplies the full ordered list and creation action at large system text sizes.
  if (!visible) return null;
  const art = <View style={styles.art} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View style={[styles.image, { transform: [{ scale: hearthScale }] }]}>
      <Animated.Image source={require('../../assets/forge/ember-haze-v01.png')} resizeMode="contain" style={[styles.glow, { opacity: glow }]} />
    </Animated.View>
    {embers.map((ember, index) => <Animated.View key={index} style={[styles.ember, {
      width: ember.size, height: ember.size, marginLeft: ember.x, top: 150 - ember.y,
      opacity: motion ? drift.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.7, 0.5, 0] }) : 0.3,
      transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 ? 12 : -12] }) }],
    }]} />)}
  </View>;
  return <View style={styles.hub}>
    {onCreate ? <Pressable accessibilityRole="button" accessibilityLabel={t('oathHome.create')} accessibilityState={{ disabled: createDisabled }}
      disabled={createDisabled} onPress={onCreate} onPressIn={() => pressHearth(true)} onPressOut={() => pressHearth(false)} style={styles.hearthTarget}>
      {({ pressed }) => <>{art}<View style={styles.createLabel}>
        <Text accessible={false} style={[styles.createMark, pressed && styles.highlight]}>＋</Text>
        <Text style={[styles.createText, pressed && styles.highlight, createDisabled && styles.disabled]}>{t('oathHome.create')}</Text>
      </View></>}
    </Pressable> : art}
    {items.length > 0 && <>
      <Text accessibilityRole="header" style={styles.caption}>{t('forge.seals')}</Text>
      <View style={styles.seals}>{items.slice(0, 3).map(item => <Seal key={item.id} item={item} onOpen={onOpen} motion={motion} clock={clock} onElapsed={onElapsed} />)}</View>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  hub: { gap: 8 }, hearthTarget: { alignItems: 'center' }, art: { height: 250, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  image: { width: 250, height: 250 },
  glow: { position: 'absolute', width: 170, height: 170, top: 70, left: 40, pointerEvents: 'none' },
  ember: { position: 'absolute', borderRadius: 3, backgroundColor: '#ffd091', pointerEvents: 'none' },
  createLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16, paddingBottom: 14 },
  createMark: { color: tokens.color.primary, fontSize: 30 }, createText: { color: tokens.color.primary, fontSize: 19, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.5 }, caption: { color: tokens.color.secondary, fontSize: 14, textAlign: 'center' },
  seals: { flexDirection: 'row', gap: 8, paddingBottom: 12 }, branch: { flex: 1, alignItems: 'center' },
  sealTarget: { alignSelf: 'stretch', alignItems: 'center', gap: 5, paddingBottom: 8 },
  highlight: { color: '#ffe1aa' },
  stateBadge: { position: 'absolute', right: -8, bottom: -6 },
  name: { color: tokens.color.text, fontSize: 14, lineHeight: 19, fontWeight: '600', textAlign: 'center', marginTop: 3 },
  state: { color: tokens.color.secondary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  deadline: { color: '#bfa987', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  chip: { alignItems: 'center', marginTop: 4 },
});
