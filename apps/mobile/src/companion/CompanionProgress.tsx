import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../localization/LocalizationProvider';
import { tokens } from '../ui/tokens';
import { AppearanceId, CompanionPresentation, appearances } from './catalog';

type ArtProps = { appearance: AppearanceId; decorative?: boolean };

function ArtPanel({ appearance, decorative = false }: ArtProps) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const selected = appearances[appearance];
  const description = t(`companion.${selected.copyKey}.description`);
  return <View style={styles.panel} accessibilityElementsHidden={decorative} importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}>
    {!decorative && <Text accessibilityRole="header" style={styles.name}>{t(`companion.${selected.copyKey}.name`)}</Text>}
    {failed ? <Text style={styles.body}>{t('companion.unavailable')}</Text> : <Image
      source={selected.image}
      style={styles.image}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : description}
      onError={() => setFailed(true)}
    />}
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

const styles = StyleSheet.create({
  progress: { gap: tokens.space.card },
  panel: { gap: tokens.space.item, backgroundColor: tokens.color.surface, padding: tokens.space.card, borderRadius: tokens.radius },
  image: { width: 180, height: 270, alignSelf: 'center' },
  name: { fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600', color: tokens.color.text },
  body: { fontSize: tokens.body, lineHeight: tokens.body * 1.5, color: tokens.color.text },
});
