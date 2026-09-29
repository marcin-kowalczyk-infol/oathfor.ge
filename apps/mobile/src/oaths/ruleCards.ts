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
