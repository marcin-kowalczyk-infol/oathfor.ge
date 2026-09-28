import { progressHint } from './progressHint';

const known = (total: number, paused = false, history = 4) => ({ today: { total, paused }, history: { total: history }, loading: false });

test('a paused character gets the pause line first', () => {
  expect(progressHint(known(3, true))).toEqual({ key: 'room.talk.hint.paused' });
  expect(progressHint(known(0, true))).toEqual({ key: 'room.talk.hint.paused' });
});

test('no current Oaths sends the player to the hearth', () => {
  expect(progressHint(known(0))).toEqual({ key: 'room.talk.hint.none' });
});

test('current Oaths send the player to the seals, the counters carry the number', () => {
  expect(progressHint(known(3))).toEqual({ key: 'room.talk.hint.current' });
});

test('without a Today answer the counts are unavailable', () => {
  expect(progressHint({ today: null, history: { total: 5 }, loading: false })).toEqual({ key: 'room.talk.hint.unavailable' });
  expect(progressHint({ today: null, history: null, loading: true })).toEqual({ key: 'room.talk.hint.unavailable' });
});

test('the chronicle count label follows the plural rules (owner decision D2)', () => {
  const { createTranslation } = jest.requireActual('../localization/createTranslation') as typeof import('../localization/createTranslation');
  const pl = createTranslation('pl');
  const en = createTranslation('en');
  expect([1, 3, 5, 22, 1.5].map(count => pl.t('room.talk.chronicle', { count }))).toEqual(['wpis w kronice', 'wpisy w kronice', 'wpisów w kronice', 'wpisy w kronice', 'wpisu w kronice']);
  expect([1, 5].map(count => en.t('room.talk.chronicle', { count }))).toEqual(['chronicle entry', 'chronicle entries']);
});
