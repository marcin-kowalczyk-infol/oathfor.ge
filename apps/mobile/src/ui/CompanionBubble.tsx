import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { tokens } from './tokens';
import { useArt } from '../art/ArtProvider';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';

/** tail: start points up at the left, as under a title or a bust. centre points up at a figure centred above the bubble. */
export function CompanionBubble({ message, tail = 'start' }: { message: string; tail?: 'start' | 'centre' }) {
  const { t, i18n } = useTranslation();
  // The style's frame fills the avatar with Żaromir's head.
  const { image, frames: { bubble: { backdrop, ...frame } } } = useArt().companion['zharomir-wanderer-v01'];
  return <View style={styles.bubble}>
    <View testID="companion-bubble-tail" style={[styles.tail, tail === 'centre' && styles.centredTail]} pointerEvents="none" accessible={false} />
    <View style={styles.speaker}>
      <View testID="companion-avatar" style={[styles.avatar, { backgroundColor: backdrop }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image testID="companion-avatar-image" source={image} resizeMode="stretch" style={[styles.portrait, frame]} />
      </View>
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.name}>{t('companion.speaker')}</Text>
    </View>
    <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.message}>{bindShortWords(message, i18n.language)}</Text>
  </View>;
}
const styles = StyleSheet.create({
  bubble: { padding: 16, gap: 10, borderRadius: 22, backgroundColor: '#eddbb4', borderWidth: 1, borderColor: '#967248', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  tail: { position: 'absolute', left: 28, top: -7, width: 14, height: 14, backgroundColor: '#eddbb4', transform: [{ rotate: '45deg' }] },
  centredTail: { left: '50%', marginLeft: -7 },
  speaker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  portrait: { position: 'absolute' },
  name: { flexShrink: 1, fontFamily: tokens.font.body, fontSize: 14, color: '#6b4d30', fontWeight: '600', letterSpacing: 0.3 },
  message: { flexShrink: 0, color: '#45311f', fontFamily: tokens.font.body, fontSize: 16, lineHeight: 25 },
});
