import { tokens } from './tokens';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export function SceneDoor({ label, onPress, disabled = false, maxLines }: { label: string; onPress(): void; disabled?: boolean; maxLines?: number }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.door, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
    <View style={styles.picture} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={require('../../assets/forge/room-prototype-v03.png')} resizeMode="stretch" style={styles.image} />
    </View>
    <Text numberOfLines={maxLines} style={styles.label}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({ door: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', paddingRight: 12 }, picture: { width: 44, height: 60, borderRadius: 10, overflow: 'hidden' }, image: { position: 'absolute', width: 142, height: 284, left: -3, top: -68 }, label: { color: '#e5d4b2', fontFamily: tokens.font.display, fontSize: 17, flexShrink: 1 } });
