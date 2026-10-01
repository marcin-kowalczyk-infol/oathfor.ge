import { compactStoredTime } from './compactStoredTime';

test('compact dates preserve the committed local day and 24-hour time in both languages', () => {
  expect(compactStoredTime('2026-09-26T16:18:00', 'en')).toBe('Sep 26, 2026 at 16:18');
  expect(compactStoredTime('2026-09-26T16:18:00', 'pl')).toBe('26 wrz 2026, 16:18');
  expect(compactStoredTime('2026-10-25T02:30:00', 'en')).toBe('Oct 25, 2026 at 02:30');
  expect(compactStoredTime('2026-10-25T02:30:00', 'pl')).toBe('25 paź 2026, 02:30');
});
