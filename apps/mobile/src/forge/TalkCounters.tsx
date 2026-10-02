import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { useArt } from '../art/ArtProvider';
import type { ForgeProgress } from './progressHint';
import { PauseMark } from '../ui/PauseMark';

const ICON = 40;

/**
 * Żaromir's counters (owner decision D5, 2026-09-28): the seal with the current Oaths and the chronicle with its entries,
 * from the server's Oath list totals. While the first answer is awaited a count shows "…", a missing one shows "–".
 * A paused character also gets the pause mark, so the pause is not only in Żaromir's line (MVP-22 slice A decision).
 */
export function TalkCounters({ progress, waiting }: { progress: ForgeProgress; waiting: boolean }) {
  const { t, i18n } = useTranslation();
  const icons = useArt().talk;
  const counter = (id: 'oaths' | 'chronicle', value: number | null, key: string, unknownKey: string) => {
    const shown = value === null ? (waiting ? '…' : '–') : String(value);
    const label = t(key, { count: value ?? 0 });
    return <View testID={`talk-counter-${id}`} accessible accessibilityLabel={value === null ? t(unknownKey) : `${shown} ${label}`} style={styles.counter}>
      <Image testID={`talk-icon-${id}`} source={icons[id]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon} />
      <View style={styles.words}>
        <Text maxFontSizeMultiplier={2} style={styles.number}>{shown}</Text>
        <Text maxFontSizeMultiplier={2} style={styles.label}>{bindShortWords(label, i18n.language)}</Text>
      </View>
    </View>;
  };
  return <View testID="talk-counters" style={styles.row}>
    {counter('oaths', progress.today?.total ?? null, 'menu.currentOaths', 'menu.currentOathsUnknown')}
    {counter('chronicle', progress.history?.total ?? null, 'room.talk.chronicle', 'room.talk.chronicleUnknown')}
    {progress.today?.paused && <View testID="talk-pause" style={styles.pause}><PauseMark state="paused" /></View>}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  counter: { flexGrow: 1, flexBasis: 130, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 6, borderWidth: 1, borderColor: '#8a6436', backgroundColor: 'rgba(0,0,0,0.25)' },
  icon: { width: ICON, height: ICON },
  pause: { flexBasis: '100%', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#8a6436', backgroundColor: 'rgba(0,0,0,0.25)' },
  words: { flexShrink: 1 },
  number: { color: '#f0dfb9', fontSize: 22, fontWeight: '700', lineHeight: 26 },
  label: { color: '#c9a77a', fontSize: 13, lineHeight: 17 },
});
