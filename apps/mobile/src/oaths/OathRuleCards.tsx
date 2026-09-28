import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Snapshot } from '../api/oathSchema';
import { SpriteFrame } from '../forge/Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { bindShortWords } from '../localization/typography';
import { ActivityEmblem } from '../ui/ActivityEmblem';
import { layoutMode } from '../ui/layoutMode';
import { tokens } from '../ui/tokens';
import { oathArt, ruleIcon } from './oathArt';
import { ruleCards, type RuleCardId } from './ruleCards';
import { promiseText, SnapshotRules } from './SnapshotRules';

const HIGHLIGHT = '#e0a84f';

/**
 * The accepted rules as the promise, the declaration and short cards, with the complete stored rules one touch away
 * (owner decision Q1: folded under "Pełne zasady"). The folded text is the unchanged SnapshotRules.
 */
export function OathRuleCards({ snapshot, highlight = null, emblem = true, onCardsLayout }: { snapshot: Snapshot; highlight?: RuleCardId | null; /** The detail shows its own emblem above. */ emblem?: boolean; /** Top of the card grid inside this view. */ onCardsLayout?(y: number): void }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);
  const { width, fontScale } = useWindowDimensions();
  const columns = layoutMode(width, fontScale) === 'room' ? 2 : 1;
  const [open, setOpen] = useState(false);
  const copy = snapshot.copy[locale];
  const text = (value: string) => bindShortWords(value, locale);
  return <View style={styles.rules}>
    <View style={styles.head}>
      {emblem && <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityEmblem activity={snapshot.activity} size={88} /></View>}
      <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{copy.title}</Text>
      <Text style={styles.promise}>{promiseText(snapshot, locale)}</Text>
    </View>
    <View style={styles.declaration}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.heading}>{t('oath.rules.declaration')}</Text>
      <Text style={styles.body}>{copy.declaration}</Text>
    </View>
    <View testID="rule-cards" onLayout={event => onCardsLayout?.(event.nativeEvent.layout.y)} style={[styles.grid, { flexDirection: columns === 2 ? 'row' : 'column' }]}>
      {ruleCards(snapshot, t, locale).map(card => <View key={card.id} testID={`rule-card-${card.id}`} accessible accessibilityLabel={`${card.title}. ${card.lines.join(' ')}`}
        style={[styles.card, columns === 2 && styles.half, card.id === highlight && styles.highlight]}>
        <SpriteFrame sheet={oathArt.ruleIcons} index={ruleIcon[card.icon]} width={40} />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{text(card.title)}</Text>
          {card.lines.map(line => <Text key={line} style={styles.cardLine}>{text(line)}</Text>)}
        </View>
      </View>)}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('oath.fullRules')} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}
      style={({ pressed }) => [styles.fold, pressed && styles.pressed]}>
      <SpriteFrame sheet={oathArt.ruleIcons} index={ruleIcon.fullRules} width={36} />
      <Text style={styles.foldText}>{t('oath.fullRules')}</Text>
      <Text style={styles.foldMark}>{open ? '▴' : '▾'}</Text>
    </Pressable>
    {open && <SnapshotRules snapshot={snapshot} />}
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
  grid: { flexWrap: 'wrap', gap: 10 },
  card: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', minHeight: 44, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: '#5b4630', backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  half: { width: '48.5%' },
  highlight: { borderColor: HIGHLIGHT, backgroundColor: 'rgba(73, 56, 33, 0.96)' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { color: tokens.color.text, fontSize: 15, fontWeight: '700' },
  cardLine: { color: tokens.color.secondary, fontSize: 14, lineHeight: 20 },
  fold: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(28, 22, 16, 0.94)' },
  foldText: { flex: 1, color: tokens.color.text, fontSize: tokens.body, fontWeight: '600' },
  foldMark: { color: tokens.color.primary, fontSize: 18 },
  pressed: { opacity: 0.75 },
});
