import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { tutorialChapters, tutorialLineKeys, tutorialTitleKey } from '../forge/tutorialChapters';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { BackLink } from '../ui/BackLink';
import { CompanionBubble } from '../ui/CompanionBubble';
import { Disclosure } from '../ui/Disclosure';
import { SceneSurface } from '../ui/SceneSurface';
import { tokens } from '../ui/tokens';

const gold = { line: 'rgba(214,170,105,0.55)', name: '#f6e6c8' };

/**
 * The Forge rules for simple layout: the room tutorial's chapters with the same copy.
 * Each chapter folds behind its title (MVP-22-A5, clarity.md rule 1), and opens its lines unchanged.
 */
export function TutorialScreen({ onBack }: { onBack(): void }) {
  const { t, i18n } = useTranslation();
  const text = (key: string) => bindShortWords(t(key), i18n.language);
  return <SceneSurface place="room">
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={styles.vignette} />
      <ScrollView testID="tutorial-scroll" contentContainerStyle={styles.content}>
        <BackLink label={t('forge.returnMenu')} onPress={onBack} />
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('tutorial.title')}</Text>
        <CompanionBubble message={text('room.tutorial.intro')} />
        {tutorialChapters.map(chapter => <View key={chapter.place} style={styles.card}>
          <Disclosure testID={`tutorial-chapter-${chapter.place}`} label={t(tutorialTitleKey(chapter.place))} heading>
            <View style={styles.lines}>{tutorialLineKeys(chapter).map(key => <Text key={key} maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.line}>{text(key)}</Text>)}</View>
          </Disclosure>
        </View>)}
      </ScrollView>
    </SafeAreaView>
  </SceneSurface>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, experimental_backgroundImage: 'radial-gradient(120% 60% at 50% 22%, rgba(255,150,60,0.10) 0%, rgba(255,150,60,0) 60%)' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  title: { fontFamily: tokens.font.display, color: gold.name, fontSize: 30, lineHeight: 36, textAlign: 'center', marginBottom: 8 },
  card: { borderRadius: 22, borderWidth: 1, borderColor: gold.line, padding: 8,
    backgroundColor: '#1f1812', experimental_backgroundImage: 'linear-gradient(180deg, rgba(42,31,21,0.94) 0%, rgba(24,19,14,0.94) 100%)' },
  lines: { gap: 12, paddingHorizontal: 8, paddingBottom: 8 },
  line: { color: tokens.color.text, fontFamily: tokens.font.body, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
