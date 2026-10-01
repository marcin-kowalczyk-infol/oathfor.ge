import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Activity, OathState } from '../api/oathSchema';
import { useArt } from '../art/ArtProvider';
import { SpriteFrame } from '../forge/Sprite';
import { useTranslation } from '../localization/LocalizationProvider';
import { ruleIcon } from '../oaths/oathArt';
import type { OathPath, PathBadge, StepStatus } from '../oaths/oathPath';
import { ActivityEmblem } from './ActivityEmblem';
import { layoutMode } from './layoutMode';
import { StateSeal } from './StateSeal';
import { Text } from './Text';
import { tokens } from './tokens';

const STEPS = ['oath', 'workout', 'assessment', 'result'] as const;
/** Cells of the step badge sheet. Assessment reuses the hourglass of waiting. The result has no corner badge, its seal is the step icon. */
const BADGE_CELL: Partial<Record<NonNullable<PathBadge>, number>> = { interrupted: 0, needsMore: 1, review: 2, waiting: 3, assessing: 3 };
const NODE = 32, ICON = 24, BADGE = 20, PIP = 8, LIST_GAP = 12;
const HIGHLIGHT = '#e0a84f', BRONZE = '#8c602e', RING = '#5b4630', GROUND = '#1c1610';

/**
 * Where the Oath stands on its four steps (docs/product/clarity.md "Step track"). The track is one accessible sentence.
 * full: four nodes joined by a line, a vertical list in the simple layout. compact: four pips with the short state label, for rows.
 * The result step draws its seal only once the server has decided it. Before that the ring stays empty, so nothing is promised.
 */
export function StepTrack({ path, state, variant = 'full', activityEmblem }: { path: OathPath; state: OathState; variant?: 'full' | 'compact'; activityEmblem?: Activity }) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const oathArt = useArt().oaths;
  const current = path.step - 1;
  const cell = path.badge === null ? undefined : BADGE_CELL[path.badge];
  // The result has no corner badge, its words are the decided state.
  const badgeWords = path.badge === 'result' ? t(`oath.states.${state}`) : cell === undefined ? null : t(`path.badge.${path.badge}`);
  const stepLabel = (index: number) => t(`path.steps.${STEPS[index]}`);
  const skipped = path.steps.flatMap((status, index) => status === 'skipped' ? [stepLabel(index)] : []);
  const sentence = badgeWords ? t('path.trackBadge', { step: path.step, label: stepLabel(current), badge: badgeWords }) : t('path.track', { step: path.step, label: stepLabel(current) });
  const label = skipped.length ? `${sentence}. ${t('path.skippedSteps', { steps: skipped.join(', ') })}` : sentence;

  if (variant === 'compact') {
    // The row speaks the label it shows.
    const shown = badgeWords ?? t(`forge.sealState.${state}`);
    const spoken = t('path.trackBadge', { step: path.step, label: stepLabel(current), badge: shown });
    return <View testID="step-track" accessible accessibilityLabel={skipped.length ? `${spoken}. ${t('path.skippedSteps', { steps: skipped.join(', ') })}` : spoken} style={styles.compact}>
      <View style={styles.pips}>
        {path.steps.map((status, index) => <View key={index} testID={`step-pip-${index + 1}-${status}`} style={[styles.pip, pipStyles[status]]} />)}
      </View>
      <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.compactLabel}>{shown}</Text>
    </View>;
  }

  const icon = (index: number, status: StepStatus) => {
    const dim = status === 'future' || status === 'skipped' ? styles.dim : null;
    if (index === 0) return <SpriteFrame sheet={oathArt.ruleIcons} index={ruleIcon.fullRules} width={ICON} style={dim} />;
    if (index === 1) return activityEmblem
      ? <View testID="step-activity" style={dim}><ActivityEmblem activity={activityEmblem} size={ICON} /></View>
      : <SpriteFrame sheet={oathArt.ruleIcons} index={ruleIcon.proof} width={ICON} style={dim} />;
    if (index === 2) return <SpriteFrame sheet={oathArt.ruleIcons} index={ruleIcon.review} width={ICON} style={dim} />;
    return path.step === 4 ? <StateSeal state={state} size={ICON} /> : null;
  };
  const node = (status: StepStatus, index: number) => <View testID={`step-node-${index + 1}-${status}`} style={[styles.node, nodeStyles[status]]}>
    {icon(index, status)}
    {index === current && cell !== undefined && <SpriteFrame testID={`step-badge-${path.badge}`} sheet={oathArt.stepBadges} index={cell} width={BADGE} style={styles.badge} />}
  </View>;

  if (layoutMode(width, fontScale) === 'simple') return <View testID="step-track" accessible accessibilityLabel={label} style={styles.list}>
    {path.steps.map((status, index) => <View key={index} testID={`step-row-${index + 1}`} style={styles.listRow}>
      {/* Each row draws its own segment from its node centre to the next row, so a row that grows keeps the line joined. */}
      {index < path.steps.length - 1 && <View testID={`step-segment-${index + 1}`} style={styles.segment} />}
      {node(status, index)}
      <View style={styles.listText}>
        <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.label, labelStyles[status]]}>{stepLabel(index)}</Text>
        {index === current && badgeWords && <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.words}>{badgeWords}</Text>}
        {status === 'skipped' && <Text maxFontSizeMultiplier={tokens.maxScale.inset} style={styles.words}>{t('path.badge.skipped')}</Text>}
      </View>
    </View>)}
  </View>;

  return <View testID="step-track" accessible accessibilityLabel={label} style={styles.row}>
    <View style={styles.rowLine} />
    {path.steps.map((status, index) => <View key={index} style={styles.column}>
      {node(status, index)}
      {/* One word per step. It shrinks to 0.85, then takes a second line, never an ellipsis. */}
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.label, styles.centred, labelStyles[status]]}>{stepLabel(index)}</Text>
      {index === current && badgeWords && <Text testID="step-words" maxFontSizeMultiplier={tokens.maxScale.inset} style={[styles.small, styles.centred]}>{badgeWords}</Text>}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8 },
  // The line runs between the first and the last node centre, behind the nodes.
  rowLine: { position: 'absolute', left: '12.5%', right: '12.5%', top: 8 + NODE / 2 - 1, height: 2, backgroundColor: RING },
  column: { flex: 1, alignItems: 'center', gap: 6 },
  list: { flexDirection: 'column', gap: LIST_GAP, paddingTop: 8 },
  segment: { position: 'absolute', left: NODE / 2 - 1, top: NODE / 2, bottom: -LIST_GAP, width: 2, backgroundColor: RING },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // The first line sits level with the node, more lines grow downwards.
  listText: { flex: 1, gap: 2, minHeight: NODE, justifyContent: 'center' },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -8, right: -10 },
  dim: { opacity: 0.4 },
  label: { fontSize: 13, lineHeight: 18 },
  centred: { textAlign: 'center' },
  words: { color: tokens.color.secondary, fontSize: 14, lineHeight: 20 },
  small: { color: tokens.color.secondary, fontSize: 12, lineHeight: 16 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pip: { width: PIP, height: PIP, borderRadius: PIP / 2, borderWidth: 1 },
  compactLabel: { flexShrink: 1, color: '#edba78', fontSize: 15, lineHeight: 22 },
});
const nodeStyles = StyleSheet.create({
  done: { backgroundColor: BRONZE, borderColor: tokens.color.primary },
  current: { backgroundColor: 'rgba(73, 56, 33, 1)', borderColor: HIGHLIGHT, borderWidth: 3 },
  future: { backgroundColor: GROUND, borderColor: RING },
  skipped: { backgroundColor: GROUND, borderColor: tokens.color.secondary, borderStyle: 'dashed' },
});
const labelStyles = StyleSheet.create({
  done: { color: tokens.color.text },
  current: { color: HIGHLIGHT, fontWeight: '700' },
  future: { color: tokens.color.secondary },
  skipped: { color: tokens.color.secondary },
});
const pipStyles = StyleSheet.create({
  done: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  current: { backgroundColor: HIGHLIGHT, borderColor: '#f3dfbd' },
  future: { backgroundColor: 'transparent', borderColor: tokens.color.secondary },
  skipped: { backgroundColor: 'transparent', borderColor: tokens.color.secondary, borderStyle: 'dashed' },
});
