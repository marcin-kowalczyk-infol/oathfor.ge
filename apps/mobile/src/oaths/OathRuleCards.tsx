import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../ui/Text';
import type { Snapshot } from '../api/oathSchema';
import { SpriteFrame } from '../forge/Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { bindShortWords } from '../localization/typography';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { Disclosure } from '../ui/Disclosure';
import { layoutMode } from '../ui/layoutMode';
import { tokens } from '../ui/tokens';
import { useArt } from '../art/ArtProvider';
import { ruleIcon } from './oathArt';
import { ruleCards, type RuleCard, type RuleCardId } from './ruleCards';
import { promiseText, SnapshotRules } from './SnapshotRules';

const HIGHLIGHT = '#e0a84f';
// VoiceOver reads a date card as "pt 2 paź 18:00 Warszawa" and the cutoff card as "18:15 15 minut po terminie".
const spoken = (card: RuleCard) => (card.time && card.lines.length > 1 ? [card.lines[0], card.time, ...card.lines.slice(1)] : [card.time, ...card.lines]).filter(Boolean).join(' ');

/**
 * The accepted rules as the promise, the declaration and short cards, with the complete stored rules one touch away
 * (owner decision Q1: folded under "Pełne zasady"). The folded text is the unchanged SnapshotRules.
 */
export function OathRuleCards({ snapshot, highlight = null, head = 'full', fold = true, onCardsLayout, onCardLayout }: { snapshot: Snapshot; highlight?: RuleCardId | null; /** promise: the detail shows its own emblem and title above, so only the promise opens the rules. */ head?: 'full' | 'promise'; /** false: the caller already folds the whole block (the detail's "Zasady Przysięgi"), so the stored rules follow the cards directly, two levels at most. */ fold?: boolean; /** Top of the card grid inside this view. */ onCardsLayout?(y: number): void; /** Top of each card inside the grid. */ onCardLayout?(id: RuleCardId, y: number): void }) {
  const oathArt = useArt().oaths;
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { width, fontScale } = useWindowDimensions();
  const columns = layoutMode(width, fontScale) === 'room' ? 2 : 1;
  const copy = snapshot.copy[locale];
  // Stored text is bound only where it is drawn, the snapshot never changes. Spoken labels keep the plain form (MVP-22-G24b).
  const text = (value: string) => bindShortWords(value, locale);
  return <View style={styles.rules}>
    <View style={styles.head}>
      {head === 'full' && <>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityEmblem activity={snapshot.activity} size={88} /></View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{copy.title}</Text>
      </>}
      {/* Native check, 2026-09-30: uncapped at the largest size the 68 pt promise broke "października" mid-word under the 56 pt title.
          The display cap keeps it at 38 pt, where the word takes about 251 of the 343 pt column. */}
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.promise}>{text(promiseText(snapshot, locale))}</Text>
    </View>
    <View style={styles.declaration}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.heading}>{t('oath.rules.declaration')}</Text>
      {/* Native check, 2026-09-30: text inside the declaration, the cards and the fold is inset, so it takes the inset cap. */}
      <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.body}>{text(copy.declaration)}</Text>
    </View>
    <View testID="rule-cards" onLayout={event => onCardsLayout?.(event.nativeEvent.layout.y)} style={[styles.grid, columns === 2 ? styles.pairs : styles.stack]}>
      {/* Native check, 2026-09-30: in one column the cards Żaromir names sit far below the grid top, so each card reports its own place. */}
      {ruleCards(snapshot, t, locale).map(card => <View key={card.id} testID={`rule-card-${card.id}`} accessible accessibilityLabel={`${card.title}. ${spoken(card)}`}
        onLayout={onCardLayout && (event => onCardLayout(card.id, event.nativeEvent.layout.y))}
        style={[styles.card, columns === 2 ? styles.half : styles.full, card.id === highlight && styles.highlight]}>
        <SpriteFrame sheet={oathArt.ruleIcons} index={ruleIcon[card.icon]} width={40} />
        <View style={styles.cardText}>
          <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.cardTitle}>{text(card.title)}</Text>
          {card.time && <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.cardTime}>{card.time}</Text>}
          {card.lines.map(line => <Text key={line} maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.cardLine}>{text(line)}</Text>)}
        </View>
      </View>)}
    </View>
    {fold ? <Disclosure label={t('oath.fullRules')} icon={<SpriteFrame sheet={oathArt.ruleIcons} index={ruleIcon.fullRules} width={36} />}>
      <SnapshotRules snapshot={snapshot} />
    </Disclosure> : <SnapshotRules snapshot={snapshot} />}
  </View>;
}
const styles = StyleSheet.create({
  rules: { gap: 16 },
  head: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  title: { color: tokens.color.text, fontFamily: tokens.font.display, fontSize: tokens.title, textAlign: 'center' },
  promise: { color: tokens.color.text, fontFamily: tokens.font.display, fontSize: 19, lineHeight: 28, textAlign: 'center' },
  declaration: { gap: 6, padding: 16, borderRadius: 16, backgroundColor: 'rgba(32, 25, 19, 0.94)', borderLeftWidth: 3, borderLeftColor: tokens.color.primary },
  heading: { color: tokens.color.primary, fontSize: 15, fontWeight: '700' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
  grid: { gap: 10 },
  pairs: { flexDirection: 'row', flexWrap: 'wrap' },
  // Native check: a wrapping column sized its line to the widest card's icon, so at text scale 1.4 every card was about 77 pt wide
  // and its flex text got no width. One column never wraps and each card stretches across the grid.
  stack: { flexDirection: 'column', flexWrap: 'nowrap' },
  card: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', minHeight: 44, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: '#5b4630', backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  half: { width: '48.5%' },
  full: { alignSelf: 'stretch' },
  highlight: { borderColor: HIGHLIGHT, backgroundColor: 'rgba(73, 56, 33, 0.96)' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { color: tokens.color.text, fontSize: 15, fontWeight: '700' },
  cardLine: { color: tokens.color.secondary, fontSize: 14, lineHeight: 20 },
  cardTime: { color: tokens.color.primary, fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
