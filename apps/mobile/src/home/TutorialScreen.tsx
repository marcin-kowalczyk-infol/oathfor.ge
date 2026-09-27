import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tutorialChapters, tutorialLineKeys, tutorialTitleKey } from '../forge/tutorialChapters';
import { useTranslation } from '../localization/LocalizationProvider';
import { BackLink } from '../ui/BackLink';
import { CompanionBubble } from '../ui/CompanionBubble';
import { SceneSurface } from '../ui/SceneSurface';
import { tokens } from '../ui/tokens';

const gold = { line: 'rgba(214,170,105,0.55)', name: '#f6e6c8' };

/** The Forge rules for simple layout: the room tutorial's chapters as one text screen, with the same copy. */
export function TutorialScreen({ onBack }: { onBack(): void }) {
  const { t } = useTranslation();
  return <SceneSurface place="room">
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={styles.vignette} />
      <ScrollView testID="tutorial-scroll" contentContainerStyle={styles.content}>
        <BackLink label={t('forge.returnMenu')} onPress={onBack} />
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={tokens.maxScale.display} style={styles.title}>{t('tutorial.title')}</Text>
        <CompanionBubble message={t('room.tutorial.intro')} />
        {tutorialChapters.map(chapter => <View key={chapter.place} style={styles.card}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={tokens.maxScale.display} style={styles.chapter}>{t(tutorialTitleKey(chapter.place))}</Text>
          {tutorialLineKeys(chapter).map(key => <Text key={key} maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.line}>{t(key)}</Text>)}
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
  card: { borderRadius: 22, borderWidth: 1, borderColor: gold.line, padding: 16, gap: 12,
    backgroundColor: '#1f1812', experimental_backgroundImage: 'linear-gradient(180deg, rgba(42,31,21,0.94) 0%, rgba(24,19,14,0.94) 100%)' },
  chapter: { fontFamily: tokens.font.display, color: gold.name, fontSize: 20, lineHeight: 26 },
  line: { color: tokens.color.text, fontFamily: tokens.font.body, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
