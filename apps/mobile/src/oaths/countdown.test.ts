import type { Oath } from '../api/oathSchema';
import { createTranslation } from '../localization/createTranslation';
import { countdownTarget, formatCountdown } from './countdown';

const oath = (state: Oath['state'], review: Oath['review'] = null) => ({
  state, review,
  snapshot: { activation: { mode: 'scheduled', time: { utc: '2026-10-02T16:00:00Z' } }, deadline: { utc: '2026-10-03T16:00:00Z' } },
}) as unknown as Oath;

test('each state counts down to its own moment or not at all', () => {
  expect(countdownTarget(oath('scheduled'))).toEqual({ kind: 'start', at: Date.parse('2026-10-02T16:00:00Z') });
  expect(countdownTarget(oath('active'))).toEqual({ kind: 'deadline', at: Date.parse('2026-10-03T16:00:00Z') });
  expect(countdownTarget(oath('review_pending', { enteredAt: '2026-10-03T16:15:01Z', closesAt: '2026-10-06T16:15:01Z' }))).toEqual({ kind: 'review', at: Date.parse('2026-10-06T16:15:01Z') });
  for (const state of ['proof_pending', 'needs_more_evidence', 'fulfilled', 'missed', 'unresolved', 'withdrawn'] as const) expect(countdownTarget(oath(state))).toBeNull();
});

const minute = 60000, hour = 60 * minute, day = 24 * hour;
test.each([
  [2 * day + 5 * hour + 59 * minute, '2 d 5 h', '2 dni 5 godzin', '2 days 5 hours'],
  [day, '1 d', '1 dzień', '1 day'],
  [5 * hour + 12 * minute + 40000, '5 h 12 min', '5 godzin 12 minut', '5 hours 12 minutes'],
  [2 * hour + 2 * minute, '2 h 2 min', '2 godziny 2 minuty', '2 hours 2 minutes'],
  [hour + minute, '1 h 1 min', '1 godzina 1 minuta', '1 hour 1 minute'],
  [12 * minute + 59000, '12 min', '12 minut', '12 minutes'],
  [22 * minute, '22 min', '22 minuty', '22 minutes'],
  [40000, '< 1 min', 'mniej niż minuta', 'less than a minute'],
])('%i ms reads %s', async (ms, short, pl, en) => {
  const polish = await createTranslation('pl'), english = await createTranslation('en');
  expect(formatCountdown(ms, polish.t.bind(polish))).toEqual({ short, spoken: pl, elapsed: false });
  expect(formatCountdown(ms, english.t.bind(english))).toEqual({ short, spoken: en, elapsed: false });
});

test('zero or less is time up', async () => {
  const polish = await createTranslation('pl'), english = await createTranslation('en');
  expect(formatCountdown(0, polish.t.bind(polish))).toEqual({ short: 'Czas minął', spoken: 'Czas minął', elapsed: true });
  expect(formatCountdown(-5000, english.t.bind(english))).toEqual({ short: 'Time is up', spoken: 'Time is up', elapsed: true });
});
