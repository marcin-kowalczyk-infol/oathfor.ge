import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Character } from '../api/characters';
import { useTranslation } from '../localization/LocalizationProvider';
import { tokens } from '../ui/tokens';
import { CharacterPortrait } from './CharacterPortrait';

export const BADGE_NAME_MIN = 72;
// Compact pill without the name: padding 4 + ringed portrait 44 + gap 8 + gap 8 + chevron about 9 + padding 12.
export const BADGE_MIN_WIDTH = BADGE_NAME_MIN + 85;

/**
 * Header entry to the change-character screen until the main menu exists.
 * Compact: a one-line pill that shrinks beside the door, the title is only in the label. Otherwise a full-width row with the title.
 */
export function CharacterBadge({ character, onPress, compact, disabled = false }: { character: Character; onPress(): void; compact: boolean; disabled?: boolean }) {
  const { t } = useTranslation();
  const title = t(`character.form.${character.form}`);
  return <Pressable accessibilityRole="button" accessibilityLabel={t('character.badge', { name: character.name, title })} accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => { if (!disabled) onPress(); }} style={({ pressed }) => [styles.badge, compact ? styles.compact : styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
    <CharacterPortrait id={character.id} presetId={character.presetId} name={character.name} size={36} active />
    <View testID="character-badge-name" style={[styles.identity, compact ? styles.compactIdentity : styles.rowIdentity]}>
      {compact
        ? <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>{character.name}</Text>
        : <><Text style={styles.name}>{character.name}</Text><Text style={styles.role}>{title}</Text></>}
    </View>
    <Text allowFontScaling={false} style={styles.chevron}>›</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  badge: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingLeft: 4, paddingRight: 12,
    borderWidth: 1, borderColor: 'rgba(214,170,105,0.55)', backgroundColor: 'rgba(20,15,10,0.85)' },
  // Beside the door the pill takes the remaining width and the name gives way first.
  compact: { flexShrink: 1, minWidth: 0, marginLeft: 'auto', borderRadius: 999 },
  row: { alignSelf: 'stretch', borderRadius: 20, paddingVertical: 8, paddingLeft: 8, gap: 12 },
  pressed: { backgroundColor: 'rgba(60,44,28,0.9)' },
  disabled: { borderColor: 'rgba(214,170,105,0.25)' },
  identity: { flexShrink: 1, minWidth: 0 },
  // Roughly seven letters stay readable before the name ellipsizes.
  compactIdentity: { minWidth: BADGE_NAME_MIN },
  // In the full-width row the text takes the free width, so the chevron sits at the right edge.
  rowIdentity: { flex: 1 },
  name: { fontFamily: tokens.font.display, color: '#f6e6c8', fontSize: 17, lineHeight: 22 },
  role: { color: '#caa06a', fontSize: 11, lineHeight: 15, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '600' },
  chevron: { color: tokens.color.primary, fontSize: 22, lineHeight: 24 },
});
