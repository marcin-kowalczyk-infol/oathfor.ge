import { AccessibilityInfo } from 'react-native';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Oath, OathState } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { createServerClock } from '../oaths/serverClock';
import { NextCard } from './NextCard';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

const oath = (state: OathState) => ({ state, review: null, snapshot: { activation: { mode: 'now', time: { utc: '2026-09-28T08:00:00Z' } }, deadline: { utc: '2026-09-28T18:00:00Z' } } }) as unknown as Oath;
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-09-28T12:00:30Z')); });
afterEach(() => jest.useRealTimers());
function clock() { const value = createServerClock(); value.observe(new Date(Date.now()).toISOString()); return value; }
const card = (state: OathState, props: Partial<Parameters<typeof NextCard>[0]> = {}) =>
  <LocalizationProvider initialLocale="pl"><NextCard oath={oath(state)} clock={clock()} line="Trening i dowód do pon 28 wrz, 20:00." {...props} /></LocalizationProvider>;

test('an active Oath shows its seal, state, one line, the countdown and one filled action', async () => {
  const onPress = jest.fn();
  await render(card('active', { action: { label: 'Prześlij dowód', onPress }, secondary: <Text>Usuń kopię</Text> }));
  expect(screen.getByTestId('detail-status')).toBeOnTheScreen();
  expect(screen.getByLabelText('Status: Aktywna')).toBeOnTheScreen();
  expect(screen.getByTestId('state-seal-active', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('Trening i dowód do pon 28 wrz, 20:00.')).toBeOnTheScreen();
  expect(screen.getByTestId('countdown-chip')).toBeOnTheScreen();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getByText('Usuń kopię')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Prześlij dowód' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a pending assessment has no countdown and keeps its details behind "Pełny opis"', async () => {
  await render(card('proof_pending', { line: 'Dowód odebrany. Wynik pojawi się tutaj.', details: <Text>Dowód odebrany pon 28 wrz, 17:55.</Text> }));
  expect(screen.queryByTestId('countdown-chip')).toBeNull();
  expect(screen.queryByText('Dowód odebrany pon 28 wrz, 17:55.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Pełny opis' }));
  expect(screen.getByText('Dowód odebrany pon 28 wrz, 17:55.')).toBeOnTheScreen();
});

test('without details there is no "Pełny opis" link', async () => {
  await render(card('fulfilled', { line: 'Przysięga spełniona.' }));
  expect(screen.queryByRole('button')).toBeNull();
});

test('announces a changed state once with its line, never on mount or an unchanged rerender', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
  announce.mockClear();
  try {
    const view = await render(card('active'));
    await view.rerender(card('active'));
    expect(announce).not.toHaveBeenCalled();
    await view.rerender(card('proof_pending', { line: 'Dowód odebrany. Wynik pojawi się tutaj.' }));
    expect(announce).toHaveBeenCalledWith('Ocena trwa. Dowód odebrany. Wynik pojawi się tutaj.', { queue: true });
    await view.rerender(card('proof_pending', { line: 'Dowód odebrany. Wynik pojawi się tutaj.' }));
    expect(announce).toHaveBeenCalledTimes(1);
  } finally { announce.mockRestore(); }
});

// Review of T09 and T09b: the line is a polite live region, and on iOS a line changed after the player's press is read out.
test('a line changed after a press is announced once, an unchanged line or a line without a press is not', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
  announce.mockClear();
  try {
    const error = 'Nie udało się połączyć z serwerem. Dowód nie został jeszcze odebrany. Kopia czeka na tym urządzeniu.';
    const view = await render(card('active', { announceLine: true }));
    expect(screen.getByText('Trening i dowód do pon 28 wrz, 20:00.').props.accessibilityLiveRegion).toBe('polite');
    await view.rerender(card('active', { announceLine: true }));
    expect(announce).not.toHaveBeenCalled();
    await view.rerender(card('active', { announceLine: true, line: error }));
    expect(announce).toHaveBeenCalledWith(error, { queue: true });
    await view.rerender(card('active', { announceLine: true, line: error }));
    await view.rerender(card('active', { line: 'Niecała godzina. Trening i dowód do pon 28 wrz, 20:00.' }));
    expect(announce).toHaveBeenCalledTimes(1);
  } finally { announce.mockRestore(); }
});

// MVP-22-B1 (G4): the drawn line binds Polish single-letter words. The announcement keeps the line as given.
test('the Polish line keeps "w" with the next word and announces the plain line', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
  const view = await render(card('active', { line: 'Dowód wyślij w terminie.' }));
  expect(screen.getByText('Dowód wyślij w\u00a0terminie.', { normalizer: text => text })).toBeOnTheScreen();
  await view.rerender(card('proof_pending', { line: 'Dowód jest w Kuźni.' }));
  expect(announce).toHaveBeenCalledWith(expect.stringContaining('Dowód jest w Kuźni.'), { queue: true });
  announce.mockRestore();
});
