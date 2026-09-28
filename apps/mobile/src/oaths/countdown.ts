import type { Oath } from '../api/oathSchema';

export type CountdownKind = 'start' | 'deadline' | 'review';
export type CountdownTarget = { kind: CountdownKind; at: number };
type Translate = (key: string, options?: Record<string, unknown>) => string;

// What a state counts down to (docs/product/oath-screens.md "Countdown"). Display only: reaching it changes no state.
export function countdownTarget(oath: Pick<Oath, 'state' | 'snapshot' | 'review'>): CountdownTarget | null {
  if (oath.state === 'scheduled' && oath.snapshot.activation.time) return { kind: 'start', at: Date.parse(oath.snapshot.activation.time.utc) };
  if (oath.state === 'active') return { kind: 'deadline', at: Date.parse(oath.snapshot.deadline.utc) };
  if (oath.state === 'review_pending' && oath.review) return { kind: 'review', at: Date.parse(oath.review.closesAt) };
  return null;
}

export const MINUTE = 60000
const HOUR = 60 * MINUTE, DAY = 24 * HOUR;
/** Short text for the chip and full words for VoiceOver. Units round down, zero units are left out. */
// Polish needs the accusative after "Start za", so the start countdown reads its units from their own keys.
export function formatCountdown(ms: number, t: Translate, grammar: 'nominative' | 'accusative' = 'nominative'): { short: string; spoken: string; elapsed: boolean } {
  const spoken = grammar === 'accusative' ? 'countdown.accusative' : 'countdown';
  if (ms <= 0) { const text = t('countdown.elapsed'); return { short: text, spoken: text, elapsed: true }; }
  if (ms < MINUTE) return { short: t('countdown.short.less'), spoken: t(`${spoken}.less`), elapsed: false };
  const days = Math.floor(ms / DAY), hours = Math.floor((ms % DAY) / HOUR), minutes = Math.floor((ms % HOUR) / MINUTE);
  const units: ['days' | 'hours' | 'minutes', number][] = days > 0 ? [['days', days], ['hours', hours]] : hours > 0 ? [['hours', hours], ['minutes', minutes]] : [['minutes', minutes]];
  const shown = units.filter(([, count], index) => index === 0 || count > 0);
  return {
    short: shown.map(([unit, count]) => t(`countdown.short.${unit}`, { count })).join(' '),
    spoken: shown.map(([unit, count]) => t(`${spoken}.${unit}`, { count })).join(' '),
    elapsed: false,
  };
}
