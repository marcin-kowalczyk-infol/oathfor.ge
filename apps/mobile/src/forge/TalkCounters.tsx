import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import type { ForgeProgress } from './progressHint';

const icons = {
  oaths: require('../../assets/forge/scene/talk-seal-v01.png'),
  chronicle: require('../../assets/forge/scene/talk-chronicle-v01.png'),
};
const ICON = 40;

/**
 * Żaromir's counters (owner decision D5, 2026-09-28): the seal with the current Oaths and the chronicle with its entries,
 * from the server's Oath list totals. While the first answer is awaited a count shows "…", a missing one shows "–".
 */
export function TalkCounters({ progress, waiting }: { progress: ForgeProgress; waiting: boolean }) {
  const { t } = useTranslation();
  const counter = (id: 'oaths' | 'chronicle', value: number | null, key: string, unknownKey: string) => {
    const shown = value === null ? (waiting ? '…' : '–') : String(value);
    const label = t(key, { count: value ?? 0 });
    return <View testID={`talk-counter-${id}`} accessible accessibilityLabel={value === null ? t(unknownKey) : `${shown} ${label}`} style={styles.counter}>
      <Image testID={`talk-icon-${id}`} source={icons[id]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon} />
      <View style={styles.words}>
        <Text maxFontSizeMultiplier={2} style={styles.number}>{shown}</Text>
        <Text maxFontSizeMultiplier={2} style={styles.label}>{label}</Text>
      </View>
    </View>;
  };
  return <View testID="talk-counters" style={styles.row}>
    {counter('oaths', progress.today?.total ?? null, 'menu.currentOaths', 'menu.currentOathsUnknown')}
    {counter('chronicle', progress.history?.total ?? null, 'room.talk.chronicle', 'room.talk.chronicleUnknown')}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  counter: { flexGrow: 1, flexBasis: 130, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 6, borderWidth: 1, borderColor: '#8a6436', backgroundColor: 'rgba(0,0,0,0.25)' },
  icon: { width: ICON, height: ICON },
  words: { flexShrink: 1 },
  number: { color: '#f0dfb9', fontSize: 22, fontWeight: '700', lineHeight: 26 },
  label: { color: '#c9a77a', fontSize: 13, lineHeight: 17 },
});
