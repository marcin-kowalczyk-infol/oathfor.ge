import { Image, StyleSheet, Text, View } from 'react-native';
import type { CharacterBuild } from '../api/characters';
import { tokens } from '../ui/tokens';
import { presetArt } from './presetArt';

/** Round portrait of a character in its build. A look the app cannot draw shows the name's first letter instead. Decorative, the caller labels it. */
export function CharacterPortrait({ id, presetId, build, name, size, active = false }: { id: string; presetId: string; build: CharacterBuild; name: string; size: number; active?: boolean }) {
  const art = presetArt(presetId, build);
  const ring = { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 };
  const inner = { width: size, height: size, borderRadius: size / 2 };
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.ring, ring, active && styles.activeRing]}>
    {art ? <Image testID={`portrait-${id}`} source={art.portrait} style={[styles.inner, inner]} />
      : <View testID={`portrait-placeholder-${id}`} style={[styles.inner, styles.placeholder, inner]}>
        <Text allowFontScaling={false} style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.52 }]}>{[...name][0] ?? ''}</Text>
      </View>}
  </View>;
}
const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(214,170,105,0.4)', backgroundColor: '#18130e' },
  activeRing: { borderWidth: 2, borderColor: '#f0c987', shadowColor: '#ffa446', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  inner: { overflow: 'hidden', backgroundColor: '#1f1812' },
  placeholder: { alignItems: 'center', justifyContent: 'center', experimental_backgroundImage: 'radial-gradient(closest-side, rgba(255,160,70,0.22) 0%, rgba(255,160,70,0) 100%)' },
  initial: { fontFamily: tokens.font.display, color: '#f6e6c8' },
});
