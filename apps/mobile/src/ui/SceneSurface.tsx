import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

/** Shared illustrated room behind functional screens. Content owns scrolling and safe areas. */
export function SceneSurface({ children, tone = 'hearth' }: { children: ReactNode; tone?: 'hearth' | 'chronicle' | 'quiet' }) {
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const scale = Math.max(size.width / 887, size.height / 1774);
  return <View style={styles.root} onLayout={({ nativeEvent: { layout } }) => {
    if (layout.width > 0 && layout.height > 0) setSize({ width: layout.width, height: layout.height });
  }}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.backdrop}>
      <Image source={require('../../assets/forge/room-prototype-v03.png')} resizeMode="stretch" style={{ position: 'absolute', width: scale * 887, height: scale * 1774, left: (size.width - scale * 887) / 2, top: (size.height - scale * 1774) / 2 }} />
      <View style={[styles.backdrop, { backgroundColor: tone === 'quiet' ? '#101719df' : tone === 'chronicle' ? '#171713cc' : '#17140dc2' }]} />
    </View>
    {children}
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#15191c' }, backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });
