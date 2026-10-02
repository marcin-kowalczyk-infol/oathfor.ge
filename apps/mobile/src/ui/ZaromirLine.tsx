import { Image, StyleSheet, View } from 'react-native';
import { useArt } from '../art/ArtProvider';
import { pickLine, ZAROMIR_POOLS } from '../companion/zaromirLine';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import type { ZaromirSituation } from '../oaths/oathPath';
import { Text } from './Text';
import { tokens } from './tokens';

const BUST = 40;

/**
 * Żaromir's one line beside his bust (docs/product/clarity.md rules 7 and 8, decision 14). Silent when the situation is null.
 * The seed keeps the line stable, the name is only in the accessibility label, and the bubble adds tone, never a fact.
 * A screen with one fixed line, such as History, passes it as message (MVP-22-B2).
 */
export function ZaromirLine(props: { situation: ZaromirSituation | null; seed: string } | { message: string }) {
  const { t, i18n } = useTranslation();
  const bust = useArt().zharomirBust;
  if ('situation' in props && props.situation === null) return null;
  const line = 'message' in props ? props.message : t(`zaromir.${props.situation}.${pickLine(props.seed, ZAROMIR_POOLS[props.situation!])}`);
  return <View accessible accessibilityLabel={`${t('companion.speaker')}: ${line}`} style={styles.row}>
    <View testID="zaromir-bust" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.bust}>
      <Image source={bust} resizeMode="cover" style={styles.image} />
    </View>
    <View style={styles.bubble}>
      <View pointerEvents="none" style={styles.tail} />
      <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.line}>{bindShortWords(line, i18n.language)}</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bust: { width: BUST, height: BUST, borderRadius: BUST / 2, overflow: 'hidden', backgroundColor: '#44372c' },
  image: { width: BUST, height: BUST },
  bubble: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#eddbb4', borderWidth: 1, borderColor: '#967248' },
  // The tail points left, at the bust.
  tail: { position: 'absolute', left: -6, top: '50%', marginTop: -6, width: 12, height: 12, backgroundColor: '#eddbb4', transform: [{ rotate: '45deg' }] },
  line: { color: '#45311f', fontFamily: tokens.font.body, fontSize: 15, lineHeight: 22 },
});
