import type { Snapshot } from '../api/oathSchema';
import type { Locale } from '../localization/locale';
import { shortStoredDay } from './compactStoredTime';
import type { RuleIconId } from './oathArt';
import { zoneLabel } from './zoneLabel';

type Translate = (key: string, options?: Record<string, unknown>) => string;
export type RuleCardId = 'start' | 'deadline' | 'cutoff' | 'proof' | 'review' | 'reward' | 'consequence' | 'fixed' | 'pause';
/** time: the hour shown large on its own line. A half-width card otherwise breaks a date line at random. */
export type RuleCard = { id: RuleCardId; icon: RuleIconId; title: string; time?: string; lines: string[] };

// S in the deadline zone. Device zone data may be missing, then D plus the stored grace keeps the wall time.
function cutoffWall(snapshot: Snapshot): string {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: snapshot.deadline.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(snapshot.deadline.receiptCutoff));
  } catch {
    return new Date(Date.parse(`${snapshot.deadline.local}Z`) + snapshot.review.receiptGraceSeconds * 1000).toISOString().slice(11, 16);
  }
}

/**
 * The rules as short cards (docs/product/oath-screens.md section 2). Every value is read from the accepted
 * snapshot, never from current policy or device settings. The full stored rule text stays available beside them.
 */
export function ruleCards(snapshot: Snapshot, t: Translate, locale: Locale): RuleCard[] {
  const names = snapshot.evidence.alternatives.map(kind => t(`oath.cards.evidence.${kind}`));
  const proof = names.join(t('oath.cards.or'));
  const card = (id: RuleCardId, icon: RuleIconId, lines: string[], time?: string): RuleCard => ({ id, icon, title: t(`oath.cards.${id}.title`), ...(time ? { time } : {}), lines });
  const at = (id: RuleCardId, icon: RuleIconId, value: { local: string; timezone: string }) => card(id, icon, [shortStoredDay(value.local, locale), zoneLabel(value.timezone, t)], value.local.slice(11, 16));
  return [
    snapshot.activation.time ? at('start', 'start', snapshot.activation.time) : card('start', 'start', [t('oath.cards.start.now')]),
    at('deadline', 'deadline', snapshot.deadline),
    card('cutoff', 'cutoff', [t('oath.cards.cutoff.after', { count: snapshot.review.receiptGraceSeconds / 60 })], cutoffWall(snapshot)),
    card('proof', 'proof', [proof.charAt(0).toLocaleUpperCase(locale) + proof.slice(1)]),
    card('review', 'review', [t('oath.cards.review.line', { count: Math.round(snapshot.review.reviewWindowSeconds / 86400) })]),
    card('reward', 'reward', [t('oath.cards.reward.line', { photo: snapshot.rewards.photoTotal, record: snapshot.rewards.recordTotal })]),
    card('consequence', 'consequence', [t('oath.cards.consequence.keep'), t('oath.cards.consequence.recovery', { recovery: snapshot.recovery.totalXp })]),
    card('fixed', 'fixed', [t('oath.cards.fixed.line')]),
    card('pause', 'pause', [t('oath.cards.pause.line')]),
  ];
}

/**
 * The review's groups (docs/product/engagement.md E3, D-E6): three large pictograms, reward and consequence as two small
 * ones (owner decision Q2 kept), and the other four cards under "Pełne zasady" with the stored rules.
 */
export const REVIEW_GROUPS = {
  large: ['deadline', 'cutoff', 'fixed'],
  small: ['reward', 'consequence'],
  folded: ['start', 'proof', 'review', 'pause'],
} as const satisfies Record<'large' | 'small' | 'folded', readonly RuleCardId[]>;
export type PictogramId = typeof REVIEW_GROUPS.large[number] | typeof REVIEW_GROUPS.small[number];
/**
 * label: one to three words beside the pictogram (clarity rule 4). values: short drawn snapshot values. spoken: the card's full facts.
 * labelValues: the values are words, not snapshot figures, so each counts as a pictogram label of at most three words.
 */
export type Pictogram = { id: PictogramId; icon: RuleIconId; label: string; values: string[]; spoken: string; labelValues?: true };

/** The review pictograms. Drawn values are short, the spoken label keeps every fact of the card it replaces. */
export function reviewPictograms(snapshot: Snapshot, t: Translate, locale: Locale): { large: Pictogram[]; small: Pictogram[] } {
  const cards = new Map(ruleCards(snapshot, t, locale).map(card => [card.id, card]));
  const deadline = cards.get('deadline')!, cutoff = cards.get('cutoff')!;
  const label = (id: PictogramId) => t(`oath.pictograms.${id}`);
  const lines = (id: RuleCardId) => cards.get(id)!.lines.join(' ');
  const item = (id: PictogramId, values: string[], spoken: string): Pictogram => ({ id, icon: id, label: label(id), values, spoken });
  return {
    large: [
      item('deadline', [deadline.time!, deadline.lines[0]], [label('deadline'), deadline.time, ...deadline.lines].join(', ')),
      item('cutoff', [t('oath.pictograms.cutoffValue', { count: snapshot.review.receiptGraceSeconds / 60 })], [label('cutoff'), cutoff.time, ...cutoff.lines].join(', ')),
      // Native check, 2026-10-02 (MVP-22-E3r): without a value line the card stood half empty beside 18:00 and +15 min.
      { ...item('fixed', [t('oath.pictograms.fixedValue')], `${label('fixed')}. ${lines('fixed')}`), labelValues: true },
    ],
    small: [
      item('reward', [t('oath.pictograms.rewardValue', { photo: snapshot.rewards.photoTotal, record: snapshot.rewards.recordTotal })], `${label('reward')}. ${lines('reward')}`),
      item('consequence', [t('oath.pictograms.consequenceValue')], `${label('consequence')}. ${lines('consequence')}`),
    ],
  };
}
