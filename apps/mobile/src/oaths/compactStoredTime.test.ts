import { compactStoredTime, pathTimeText } from './compactStoredTime';

const nbsp = (text: string) => text.replace(/ /g, '\u00a0');

test('compact dates preserve the committed local day and 24-hour time in both languages', () => {
  expect(compactStoredTime('2026-09-26T16:18:00', 'en')).toBe('Sep 26, 2026 at 16:18');
  expect(compactStoredTime('2026-09-26T16:18:00', 'pl')).toBe('26 wrz 2026, 16:18');
  expect(compactStoredTime('2026-10-25T02:30:00', 'en')).toBe('Oct 25, 2026 at 02:30');
  expect(compactStoredTime('2026-10-25T02:30:00', 'pl')).toBe('25 paź 2026, 02:30');
});

test('path lines show the short day and time, with the offset only in the hour that repeats', () => {
  expect(pathTimeText({ local: '2026-10-29T02:30:00', timezone: 'Europe/Warsaw', offset: '+01:00' }, 'pl')).toBe(nbsp('czw 29 paź 02:30'));
  expect(pathTimeText({ local: '2026-10-29T02:30:00', timezone: 'Europe/Warsaw', offset: '+01:00' }, 'en')).toBe(nbsp('Thu, Oct 29, 02:30'));
  expect(pathTimeText({ local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00' }, 'pl')).toBe(nbsp('niedz 25 paź 02:30 (UTC+02:00)'));
  expect(pathTimeText({ local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+01:00' }, 'en')).toBe(nbsp('Sun, Oct 25, 02:30 (UTC+01:00)'));
  expect(pathTimeText({ local: '2026-10-25T03:30:00', timezone: 'Europe/Warsaw', offset: '+01:00' }, 'en')).toBe(nbsp('Sun, Oct 25, 03:30'));
  expect(pathTimeText({ local: '2026-10-25T02:30:00', timezone: 'UTC', offset: '+00:00' }, 'en')).toBe(nbsp('Sun, Oct 25, 02:30'));
});

// Native check, MVP-22-T09c: the card line broke as "do pt 2 paź" / "04:14." The day and time now hold together.
test('a path time never breaks between its parts', () => {
  const samples = [
    pathTimeText({ local: '2026-10-02T04:14:00', timezone: 'Europe/Warsaw', offset: '+02:00' }, 'pl'),
    pathTimeText({ local: '2026-10-02T04:14:00', timezone: 'Europe/Warsaw', offset: '+02:00' }, 'en'),
    pathTimeText({ local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00' }, 'pl'),
  ];
  for (const text of samples) {
    expect(text).not.toContain(' ');
    expect(text).toContain('\u00a0');
  }
});
