import type { ReactNode } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../ui/tokens';
import { useTranslation } from '../localization/LocalizationProvider';

/**
 * Żaromir's speech bubble in the Forge room. The room decides its frame, this component draws it.
 * `reveal` animates the entrance, null shows it at once. `pointX` is the screen x of the place the tail points to.
 * `fill` makes the text scroll inside a fixed height, for large text.
 */
export function RoomBubble({ frame, reveal, pointX, contentKey, fill, onContentHeight, dismissLabel, onDismiss, footer, children }: {
  frame: { left: number; top: number; width: number; maxHeight: number; height?: number };
  reveal: Animated.Value | null; pointX: number; contentKey: string; fill: boolean;
  onContentHeight: (height: number) => void; dismissLabel: string; onDismiss: () => void;
  footer?: ReactNode; children: ReactNode;
}) {
  const { t } = useTranslation();
  return <Animated.View testID="room-bubble" style={[styles.bubble, frame, {
    opacity: reveal ?? 1, transform: [{ translateY: reveal ? reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) : 0 }] }]}>
    <View pointerEvents="none" accessible={false} style={[styles.bubbleTail, { left: Math.max(24, Math.min(frame.width - 40, pointX - frame.left - 9)) }]} />
    <ScrollView key={contentKey} style={fill ? { flex: 1 } : { flexGrow: 0, flexShrink: 1 }} testID="room-bubble-content" onContentSizeChange={(_, measured) => onContentHeight(measured)} contentContainerStyle={styles.bubbleContent} accessibilityLiveRegion="polite">
      <View style={styles.speakerRow}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.avatar}>
          <Image source={require('../../assets/companion/zharomir-wanderer-v01.png')} resizeMode="stretch" style={styles.avatarImage} />
        </View>
        <Text maxFontSizeMultiplier={2} style={styles.speaker}>{t('room.speaker')}</Text>
      </View>
      {children}
    </ScrollView>
    {footer}
    <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} onPress={onDismiss} style={styles.dismiss}><Text accessible={false} allowFontScaling={false} style={styles.dismissMark}>×</Text></Pressable>
  </Animated.View>;
}

/** Footer height counted by the room when it decides how far a bubble grows upward. */
export const BUBBLE_FOOTER = 44;

/** A step counter with a next control, used by the guide. */
export function BubbleSteps({ count, label, mark, onPress }: { count: string; label: string; mark: string; onPress: () => void }) {
  return <View style={styles.footer}>
    <Text accessible={false} allowFontScaling={false} style={styles.stepCount}>{count}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.next}>
      <Text accessible={false} allowFontScaling={false} style={styles.nextMark}>{mark}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', zIndex: 4, backgroundColor: '#f0dfb9', borderColor: '#6c4c2f', borderWidth: 2, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  bubbleTail: { position: 'absolute', width: 18, height: 18, top: -10, backgroundColor: '#f0dfb9', borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#6c4c2f', transform: [{ rotate: '45deg' }] },
  bubbleContent: { padding: 12, paddingRight: 40 },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#44372c', flexShrink: 0 },
  avatarImage: { position: 'absolute', width: 180.224, height: 270.336, left: -73.92, top: -3.52 },
  speaker: { color: '#47311e', fontFamily: tokens.font.body, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  footer: { height: BUBBLE_FOOTER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 6 },
  next: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center' },
  nextMark: { color: '#69431e', fontSize: 30 },
  stepCount: { color: '#725339', fontSize: 12 },
  dismiss: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissMark: { color: '#725339', fontSize: 28 },
});
