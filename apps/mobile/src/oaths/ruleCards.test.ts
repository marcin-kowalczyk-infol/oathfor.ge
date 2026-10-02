import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Snapshot } from '../api/oathSchema';
import { createTranslation } from '../localization/createTranslation';
import { REVIEW_GROUPS, reviewPictograms, ruleCards } from './ruleCards';

function snapshot(patch: (value: Snapshot) => void = () => {}): Snapshot {
  const value = JSON.parse(JSON.stringify(catalog));
  value.activity = 'running'; value.activation = { mode: 'now', time: null };
  value.deadline = { local: '2026-10-02T18:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-02T16:00:00Z', receiptCutoff: '2026-10-02T16:15:00Z' };
  for (const locale of ['pl', 'en']) { value.copy[locale].activity = value.copy[locale].activities.running; delete value.copy[locale].activities; }
  patch(value);
  return value;
}
const build = (value: Snapshot, locale: 'pl' | 'en') => { const i18n = createTranslation(locale); return ruleCards(value, i18n.t.bind(i18n), locale); };
const line = (cards: ReturnType<typeof ruleCards>, id: string) => cards.find(card => card.id === id)!.lines.join(' ');
const time = (cards: ReturnType<typeof ruleCards>, id: string) => cards.find(card => card.id === id)!.time;

test('Polish cards carry the snapshot values in order', () => {
  const cards = build(snapshot(), 'pl');
  expect(cards.map(card => card.id)).toEqual(['start', 'deadline', 'cutoff', 'proof', 'review', 'reward', 'consequence', 'fixed', 'pause']);
  expect(cards.map(card => card.title)).toEqual(['Start', 'Termin', 'Ostatni moment na dowód', 'Dowód', 'Pod rozwagą', 'Nagroda', 'Jeśli nie zdążysz', 'Zasady są stałe', 'Pauza']);
  expect(line(cards, 'start')).toBe('Od razu po złożeniu');
  // A half-width card breaks a long date line anywhere. The hour stands alone, the day and zone sit under it.
  expect(time(cards, 'deadline')).toBe('18:00');
  expect(cards.find(card => card.id === 'deadline')!.lines).toEqual(['pt 2 paź', 'Warszawa']);
  expect(time(cards, 'cutoff')).toBe('18:15');
  expect(line(cards, 'cutoff')).toBe('15 minut po terminie');
  expect(time(cards, 'start')).toBeUndefined();
  expect(line(cards, 'proof')).toBe('Zdjęcie albo zapis aktywności');
  expect(line(cards, 'review')).toBe('Najdłużej 3 dni');
  expect(line(cards, 'reward')).toBe('40 XP za zdjęcie, 50 XP za zapis aktywności');
  expect(line(cards, 'consequence')).toBe('Nie tracisz zdobytego XP. Możesz podjąć Zadanie Powrotu za 15 XP.');
  expect(line(cards, 'fixed')).toBe('Po złożeniu zasady się nie zmienią.');
  expect(line(cards, 'pause')).toBe('Pauza wycofuje Przysięgi bez dowodu.');
});

test('English cards and a scheduled start in its own zone', () => {
  const cards = build(snapshot(value => { value.activation = { mode: 'scheduled', time: { local: '2026-10-01T07:30:00', timezone: 'Europe/London', offset: '+01:00', explicitOffset: false, utc: '2026-10-01T06:30:00Z' } }; }), 'en');
  expect(cards.map(card => card.title)).toEqual(['Start', 'Deadline', 'Last chance for proof', 'Proof', 'Review', 'Reward', 'If you miss it', 'The rules are fixed', 'Pause']);
  expect(time(cards, 'start')).toBe('07:30');
  expect(line(cards, 'start')).toBe('Thu, Oct 1 London');
  expect(time(cards, 'deadline')).toBe('18:00');
  expect(line(cards, 'deadline')).toBe('Fri, Oct 2 Warsaw');
  expect(time(cards, 'cutoff')).toBe('18:15');
  expect(line(cards, 'cutoff')).toBe('15 minutes after the deadline');
  expect(line(cards, 'proof')).toBe('A photo or an activity record');
  expect(line(cards, 'review')).toBe('Up to 3 days');
  expect(line(cards, 'reward')).toBe('40 XP for a photo, 50 XP for an activity record');
  expect(line(cards, 'consequence')).toBe('You keep the XP you earned. You can take a Recovery Quest for 15 XP.');
});

test('numbers come from the snapshot, not from the current policy', () => {
  const cards = build(snapshot(value => {
    Object.assign(value.rewards, { photoTotal: 45, recordTotal: 55 });
    Object.assign(value.review, { reviewWindowSeconds: 86400 });
    Object.assign(value.recovery, { totalXp: 20 });
  }), 'pl');
  expect(line(cards, 'reward')).toBe('45 XP za zdjęcie, 55 XP za zapis aktywności');
  expect(line(cards, 'review')).toBe('Najdłużej 1 dzień');
  expect(line(cards, 'consequence')).toContain('20 XP');
});

// MVP-22-B2 (G20): the line under "Pod rozwagą" names only the length, in every plural form.
test.each([[1, 'Najdłużej 1 dzień', 'Up to 1 day'], [2, 'Najdłużej 2 dni', 'Up to 2 days'], [5, 'Najdłużej 5 dni', 'Up to 5 days'], [22, 'Najdłużej 22 dni', 'Up to 22 days']])(
  'a review window of %i days reads in both languages', (days, pl, en) => {
    const value = snapshot(patch => { Object.assign(patch.review, { reviewWindowSeconds: days * 86400 }); });
    expect(line(build(value, 'pl'), 'review')).toBe(pl);
    expect(line(build(value, 'en'), 'review')).toBe(en);
  });

const pictogramsOf = (value: Snapshot, locale: 'pl' | 'en') => { const i18n = createTranslation(locale); return reviewPictograms(value, i18n.t.bind(i18n), locale); };
// MVP-22-E3.2 (engagement.md E3, D-E6): the review groups the cards into three large pictograms, two small ones and the fold.
test('the review groups cover every card once', () => {
  const ids = build(snapshot(), 'en').map(card => card.id);
  expect(REVIEW_GROUPS).toEqual({ large: ['deadline', 'cutoff', 'fixed'], small: ['reward', 'consequence'], folded: ['start', 'proof', 'review', 'pause'] });
  expect([...REVIEW_GROUPS.large, ...REVIEW_GROUPS.small, ...REVIEW_GROUPS.folded].sort()).toEqual([...ids].sort());
});
test.each([
  ['pl', { deadline: ['Termin', '18:00', 'pt 2 paź'], cutoff: ['Ostatni moment', '+15 min'], fixed: ['Zasady stałe', 'bez zmian'], reward: ['Nagroda', '40–50 XP'], consequence: ['Jeśli nie zdążysz', 'XP zostaje'] }],
  ['en', { deadline: ['Deadline', '18:00', 'Fri, Oct 2'], cutoff: ['Last chance', '+15 min'], fixed: ['Rules fixed', 'no changes'], reward: ['Reward', '40–50 XP'], consequence: ['If missed', 'XP kept'] }],
] as const)('%s pictograms carry a short label and short snapshot values', (locale, expected) => {
  const pictograms = pictogramsOf(snapshot(), locale);
  const shown = Object.fromEntries([...pictograms.large, ...pictograms.small].map(item => [item.id, [item.label, ...item.values]]));
  expect(shown).toEqual(expected);
  for (const item of [...pictograms.large, ...pictograms.small]) expect(item.label.split(/\s+/).length).toBeLessThanOrEqual(3);
  // Native check, 2026-10-02: the fixed rules card stood with an empty lower half beside 18:00 and +15 min. Its value line is
  // words, not a snapshot figure, so it counts as a pictogram label of at most three words (owner decision, MVP-22-E3r).
  const fixed = pictograms.large.find(item => item.id === 'fixed')!;
  expect(fixed.labelValues).toBe(true);
  for (const value of fixed.values) expect(value.split(/\s+/).length).toBeLessThanOrEqual(3);
  expect(pictograms.large.filter(item => item.labelValues).map(item => item.id)).toEqual(['fixed']);
});
test('the pictogram values follow the snapshot, not fixed copy', () => {
  const value = snapshot(next => { Object.assign(next.review, { receiptGraceSeconds: 1800 }); Object.assign(next.rewards, { photoTotal: 45, recordTotal: 60 }); });
  const pictograms = pictogramsOf(value, 'en');
  expect(pictograms.large.find(item => item.id === 'cutoff')!.values).toEqual(['+30 min']);
  expect(pictograms.small.find(item => item.id === 'reward')!.values).toEqual(['45–60 XP']);
});
