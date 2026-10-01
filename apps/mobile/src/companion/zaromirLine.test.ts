import { pickLine, zaromirSeed, ZAROMIR_POOLS } from './zaromirLine';

const id = '20000000-0000-4000-8000-000000000001';
const ids = Array.from({ length: 50 }, (_, n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
// Local midnight in Warsaw on 2026-10-03 (CEST, UTC+2) is 22:00 UTC the day before.
const lateEvening = Date.parse('2026-10-02T21:59:00Z'), nextMorning = Date.parse('2026-10-02T22:01:00Z');

test('picks with 32-bit FNV-1a', () => {
  expect(pickLine('a', 2 ** 32)).toBe(0xe40c292c);
  expect(pickLine('foobar', 2 ** 32)).toBe(0xbf9cf968);
});

test('the seed keeps one local day of the Oath and changes on the next', () => {
  // 2026-10-02 in Warsaw (UTC+2) runs from 22:00 UTC the day before to 21:59:59 UTC.
  const seed = (instant: string) => zaromirSeed(id, 'active', Date.parse(instant), 'Europe/Warsaw');
  expect(seed('2026-10-01T22:01:00Z')).toBe(seed('2026-10-02T21:59:00Z'));
  expect(seed('2026-10-02T21:59:00Z')).not.toBe(seed('2026-10-02T22:01:00Z'));
});

test('50 Oaths reach every line of a pool of 4', () => {
  expect(new Set(ids.map(oathId => pickLine(zaromirSeed(oathId, 'scheduled', lateEvening, 'Europe/Warsaw'), 4)))).toEqual(new Set([0, 1, 2, 3]));
});

test('the next local day of the Oath can change the line', () => {
  expect(zaromirSeed(id, 'active', lateEvening, 'Europe/Warsaw')).toBe(`${id}:active:2026-10-02`);
  expect(zaromirSeed(id, 'active', nextMorning, 'Europe/Warsaw')).toBe(`${id}:active:2026-10-03`);
  expect(ids.some(oathId => pickLine(zaromirSeed(oathId, 'active', lateEvening, 'Europe/Warsaw'), 5) !== pickLine(zaromirSeed(oathId, 'active', nextMorning, 'Europe/Warsaw'), 5))).toBe(true);
});

test('without a server clock the line depends on the Oath and situation only', () => {
  expect(zaromirSeed(id, 'review', null, 'Europe/Warsaw')).toBe(`${id}:review`);
});

test('every situation has a pool, review and the interrupted upload exactly one line', () => {
  expect(ZAROMIR_POOLS).toEqual({ scheduled: 5, active: 5, activeSoon: 4, cutoff: 3, interrupted: 1, assessing: 5, review: 1, fulfilled: 5, missed: 3, unresolved: 2, withdrawn: 3, confirmed: 3, confirmedScheduled: 2, proofScreen: 3 });
  expect(ZAROMIR_POOLS.review).toBe(1);
  expect(ZAROMIR_POOLS.interrupted).toBe(1);
  expect(Object.values(ZAROMIR_POOLS).every(size => size >= 1)).toBe(true);
});
