import { Image, StyleSheet, Text, View } from 'react-native';
import { tokens } from './tokens';
import { useTranslation } from '../localization/LocalizationProvider';

export function CompanionBubble({ message }: { message: string }) {
  const { t } = useTranslation();
  return <View style={styles.bubble}>
    <View style={styles.tail} pointerEvents="none" accessible={false} />
    <View style={styles.speaker}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={require('../../assets/companion/zharomir-wanderer-v01.png')} resizeMode="stretch" style={styles.portrait} />
      </View>
      <Text maxFontSizeMultiplier={tokens.maxScale.display} style={styles.name}>{t('companion.speaker')}</Text>
    </View>
    <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.message}>{message}</Text>
  </View>;
}
const styles = StyleSheet.create({
  bubble: { padding: 16, gap: 10, borderRadius: 22, backgroundColor: '#eddbb4', borderWidth: 1, borderColor: '#967248', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  tail: { position: 'absolute', left: 28, top: -7, width: 14, height: 14, backgroundColor: '#eddbb4', transform: [{ rotate: '45deg' }] },
  speaker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#44372c' },
  portrait: { position: 'absolute', width: 180.224, height: 270.336, left: -73.92, top: -3.52 },
  name: { flexShrink: 1, fontFamily: tokens.font.body, fontSize: 14, color: '#6b4d30', fontWeight: '600', letterSpacing: 0.3 },
  message: { flexShrink: 0, color: '#45311f', fontFamily: tokens.font.body, fontSize: 16, lineHeight: 25 },
});
