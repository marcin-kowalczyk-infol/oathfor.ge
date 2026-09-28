import { StyleSheet, Text, View } from 'react-native';
import type { Character } from '../api/characters';
import { useTranslation } from '../localization/LocalizationProvider';
import type { ForgeProgress } from './progressHint';

/**
 * The statistics card in Żaromir's talk: name, form title, build and the server counts of current Oaths and chronicle entries.
 * A missing count shows a dash. XP and level wait for MVP-09.
 */
export function TalkCard({ character, progress }: { character: Pick<Character, 'name' | 'form' | 'build'>; progress: ForgeProgress }) {
  const { t } = useTranslation();
  const today = progress.today?.total ?? null;
  const history = progress.history?.total ?? null;
  const count = (value: number | null, key: string) => value === null ? `– ${t(key, { count: 0 })}` : `${value} ${t(key, { count: value })}`;
  return <View testID="talk-card" style={styles.card}>
    <Text maxFontSizeMultiplier={2} style={styles.name}>{character.name}</Text>
    <Text maxFontSizeMultiplier={2} style={styles.detail}>{t(`character.form.${character.form}`)} · {t(`character.build.${character.build}`)}</Text>
    <Text maxFontSizeMultiplier={2} style={styles.count}>{count(today, 'menu.currentOaths')}</Text>
    <Text maxFontSizeMultiplier={2} style={styles.count}>{count(history, 'room.talk.chronicle')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#8a6436', backgroundColor: 'rgba(0,0,0,0.25)' },
  name: { color: '#f0dfb9', fontSize: 17, fontWeight: '600' },
  detail: { color: '#c9a77a', fontSize: 14, marginBottom: 4 },
  count: { color: '#f0dfb9', fontSize: 15, lineHeight: 21 },
});
