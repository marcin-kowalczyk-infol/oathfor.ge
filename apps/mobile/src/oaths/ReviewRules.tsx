import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Snapshot } from '../api/oathSchema';
import { useArt } from '../art/ArtProvider';
import { SpriteFrame } from '../forge/Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { bindShortWords } from '../localization/typography';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { Disclosure } from '../ui/Disclosure';
import { layoutMode } from '../ui/layoutMode';
import { Text } from '../ui/Text';
import { tokens } from '../ui/tokens';
import { ruleIcon } from './oathArt';
import { RuleCardGrid } from './OathRuleCards';
import { REVIEW_GROUPS, reviewPictograms, ruleCards, type Pictogram, type PictogramId } from './ruleCards';
import { SnapshotRules } from './SnapshotRules';

const HIGHLIGHT = '#e0a84f';
// DUMMY until MVP-22-E3.5: the 160 px rule icon cells scaled to about 96 and 48 pt (engagement.md E3 "Fallback").
const LARGE = 96;
const SMALL = 48;

/**
 * The rules review as pictograms (docs/product/engagement.md E3, D-E6): the activity, three large pictograms for the
 * deadline, the last chance and the fixed rules, and two small ones for reward and consequence (owner decision Q2 kept).
 * Every label has one to three words beside its pictogram and is exempt from the word budget as `icon`. Every pictogram
 * speaks the full facts of the card it replaces. The other cards and the stored rules sit in ReviewFold.
 */
export function ReviewRules({ snapshot, highlight = null, onRowLayout, onPictogramLayout }: { snapshot: Snapshot; highlight?: PictogramId | null; /** Top of the large pictogram row inside this view. */ onRowLayout?(y: number): void; /** Top of each large pictogram inside its row. */ onPictogramLayout?(id: PictogramId, y: number): void }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { width, fontScale } = useWindowDimensions();
  const room = layoutMode(width, fontScale) === 'room';
  const { large, small } = reviewPictograms(snapshot, t, locale);
  const activity = snapshot.copy[locale].activity;
  return <View style={styles.review}>
    <View style={styles.head} accessible accessibilityLabel={activity}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityEmblem activity={snapshot.activity} size={56} /></View>
      <Text budget="icon" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.activity}>{bindShortWords(activity, locale)}</Text>
    </View>
    <View testID="review-pictograms" onLayout={event => onRowLayout?.(event.nativeEvent.layout.y)} style={[styles.large, room ? styles.row : styles.column]}>
      {large.map(item => <PictogramView key={item.id} item={item} size={LARGE} room={room} highlighted={item.id === highlight}
        onLayout={onPictogramLayout && (y => onPictogramLayout(item.id, y))} />)}
    </View>
    <View testID="review-small" style={[styles.small, room ? styles.row : styles.column]}>
      {small.map(item => <PictogramView key={item.id} item={item} size={SMALL} room={room} />)}
    </View>
  </View>;
}

function PictogramView({ item, size, room, highlighted = false, onLayout }: { item: Pictogram; size: number; room: boolean; highlighted?: boolean; onLayout?(y: number): void }) {
  const art = useArt().oaths;
  const { i18n } = useTranslation();
  const large = size === LARGE;
  // A large pictogram stands above its label in the room's three columns. Small ones and the simple layout put the label beside it.
  const stacked = large && room;
  return <View testID={`pictogram-${item.id}`} accessible accessibilityLabel={item.spoken}
    onLayout={onLayout && (event => onLayout(event.nativeEvent.layout.y))}
    style={[styles.pictogram, stacked ? styles.stacked : styles.beside, room && styles.share, highlighted && styles.highlight]}>
    <SpriteFrame testID={`pictogram-art-${item.id}`} sheet={art.ruleIcons} index={ruleIcon[item.icon]} width={size} />
    <View style={[styles.words, stacked && styles.centred]}>
      <Text budget="icon" maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.label, stacked && styles.centredText]}>{bindShortWords(item.label, i18n.language)}</Text>
      {item.values.map((value, index) => <Text key={value} maxFontSizeMultiplier={tokens.maxScale.inset}
        style={[index === 0 ? styles.value : styles.detail, !large && styles.smallValue, stacked && styles.centredText]}>{value}</Text>)}
    </View>
  </View>;
}

/** "Pełne zasady": the start, proof, review and pause cards with the complete stored rules, unchanged (owner decision Q1). */
export function ReviewFold({ snapshot }: { snapshot: Snapshot }) {
  const art = useArt().oaths;
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const folded: readonly string[] = REVIEW_GROUPS.folded;
  return <Disclosure label={t('oath.fullRules')} icon={<SpriteFrame sheet={art.ruleIcons} index={ruleIcon.fullRules} width={36} />}>
    <View style={styles.fold}>
      <RuleCardGrid cards={ruleCards(snapshot, t, locale).filter(card => folded.includes(card.id))} />
      <SnapshotRules snapshot={snapshot} />
    </View>
  </Disclosure>;
}

const styles = StyleSheet.create({
  review: { gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  activity: { color: tokens.color.text, fontFamily: tokens.font.display, fontSize: 22, lineHeight: 30, flexShrink: 1 },
  large: { gap: 8 },
  small: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flexDirection: 'column' },
  share: { flex: 1, flexBasis: 0 },
  pictogram: { minHeight: 44, padding: 10, gap: 8, borderRadius: 16, borderWidth: 2, borderColor: '#5b4630', backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  stacked: { alignItems: 'center' },
  beside: { flexDirection: 'row', alignItems: 'center' },
  highlight: { borderColor: HIGHLIGHT, backgroundColor: 'rgba(73, 56, 33, 0.96)' },
  words: { flexShrink: 1, gap: 2 },
  centred: { alignItems: 'center' },
  centredText: { textAlign: 'center' },
  label: { color: tokens.color.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  value: { color: tokens.color.primary, fontSize: 20, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  detail: { color: tokens.color.secondary, fontSize: 14, lineHeight: 20 },
  smallValue: { fontSize: 16, lineHeight: 22 },
  fold: { gap: 16 },
});
