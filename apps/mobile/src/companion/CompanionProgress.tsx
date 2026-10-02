import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useArt } from '../art/ArtProvider';
import { useTranslation } from '../localization/LocalizationProvider';
import { tokens } from '../ui/tokens';
import { AppearanceId, CompanionPresentation, appearances } from './catalog';

/** scale shrinks the 180 × 270 panel and Żaromir's frame together, so he keeps his place in it. */
type ArtProps = { appearance: AppearanceId; decorative?: boolean; scale?: number };

function ArtPanel({ appearance, decorative = false, scale = 1 }: ArtProps) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const selected = appearances[appearance];
  const { image, frames } = useArt().companion[appearance];
  const description = t(`companion.${selected.copyKey}.description`);
  const place = { left: frames.panel.left * scale, top: frames.panel.top * scale, width: frames.panel.width * scale, height: frames.panel.height * scale };
  return <View testID="companion-art-panel" style={styles.panel} accessibilityElementsHidden={decorative} importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}>
    {!decorative && <Text accessibilityRole="header" style={styles.name}>{t(`companion.${selected.copyKey}.name`)}</Text>}
    {/* The style's frame keeps Żaromir the same size in the 180 × 270 panel, whatever his size in the picture. */}
    {failed ? <Text style={styles.body}>{t('companion.unavailable')}</Text> : <View testID="companion-art-frame" style={[styles.frame, { width: FRAME.width * scale, height: FRAME.height * scale }]}><Image
      source={image}
      style={[styles.image, place]}
      resizeMode="stretch"
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : description}
      onError={() => setFailed(true)}
    /></View>}
    {!decorative && <Text style={styles.body}>{description}</Text>}
  </View>;
}

export function CompanionArt(props: ArtProps) {
  return <ArtPanel key={props.appearance} {...props} />;
}

export function CompanionProgress({ current, next }: CompanionPresentation) {
  const { t } = useTranslation();
  return <View style={styles.progress}>
    <Text style={styles.body}>{t('companion.current')}</Text>
    <CompanionArt appearance={current} />
    {next === null ? <Text accessibilityRole="header" style={styles.name}>{t('companion.complete')}</Text> : <>
      <Text style={styles.body}>{t('companion.locked')}</Text>
      <CompanionArt appearance={next} />
    </>}
  </View>;
}

const FRAME = { width: 180, height: 270 };
const styles = StyleSheet.create({
  progress: { gap: tokens.space.card },
  panel: { gap: tokens.space.item, backgroundColor: tokens.warm.panel, borderWidth: 1, borderColor: tokens.warm.line, padding: tokens.space.card, borderRadius: tokens.radius },
  frame: { ...FRAME, alignSelf: 'center', overflow: 'hidden' },
  image: { position: 'absolute' },
  name: { fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600', color: tokens.color.text },
  body: { fontSize: tokens.body, lineHeight: tokens.body * 1.5, color: tokens.color.text },
});
