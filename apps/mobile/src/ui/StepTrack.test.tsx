import { Dimensions, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type { OathState } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { OathPath } from '../oaths/oathPath';
import { StepTrack } from './StepTrack';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

const size = (width: number, fontScale: number) => Dimensions.set({ window: { width, height: 874, scale: 3, fontScale }, screen: { width, height: 874, scale: 3, fontScale } });
beforeEach(() => size(402, 1));

const path = (patch: Partial<OathPath>): OathPath => ({ step: 2, steps: ['done', 'current', 'future', 'future'], badge: null, next: { key: 'path.next.active' }, action: 'submitProof', zaromir: 'active', ...patch });
const hidden = { includeHiddenElements: true };
const show = (value: OathPath, state: OathState, extra: { variant?: 'full' | 'compact'; locale?: 'pl' | 'en'; activityEmblem?: 'running' } = {}) =>
  render(<LocalizationProvider initialLocale={extra.locale ?? 'pl'}><StepTrack path={value} state={state} variant={extra.variant} activityEmblem={extra.activityEmblem} /></LocalizationProvider>);

test('an active Oath shows four labelled steps in a row, read as one sentence', async () => {
  await show(path({}), 'active');
  const track = screen.getByTestId('step-track');
  expect(track).toHaveProp('accessible', true);
  expect(track).toHaveProp('accessibilityLabel', 'Etap 2 z 4, Trening');
  expect(StyleSheet.flatten(track.props.style)).toMatchObject({ flexDirection: 'row' });
  for (const label of ['Przysięga', 'Trening', 'Ocena', 'Wynik']) expect(screen.getByText(label)).toBeOnTheScreen();
  for (const id of ['step-node-1-done', 'step-node-2-current', 'step-node-3-future', 'step-node-4-future']) expect(screen.getByTestId(id, hidden)).toBeTruthy();
  // A short label shrinks a little, then takes a second line, never an ellipsis.
  expect(screen.getByText('Przysięga').props).toMatchObject({ numberOfLines: 2, adjustsFontSizeToFit: true });
  expect(screen.getByText('Przysięga').props.minimumFontScale).toBeGreaterThanOrEqual(0.85);
});

test('an interrupted upload puts the badge on the workout step and names it', async () => {
  await show(path({ badge: 'interrupted', action: 'sendAgain', zaromir: 'interrupted' }), 'active');
  expect(screen.getByTestId('step-track')).toHaveProp('accessibilityLabel', 'Etap 2 z 4, Trening, Nie dotarł');
  expect(screen.getByTestId('step-node-2-current', hidden)).toContainElement(screen.getByTestId('step-badge-interrupted', hidden));
  // The amber badge carries its words under the step in the row too (clarity rule 4).
  expect(screen.getByTestId('step-words', hidden)).toHaveTextContent('Nie dotarł');
});

test('a scheduled Oath has the oath step done with the waiting badge on it', async () => {
  await show(path({ step: 1, steps: ['done', 'future', 'future', 'future'], badge: 'waiting' }), 'scheduled', { locale: 'en' });
  expect(screen.getByTestId('step-track')).toHaveProp('accessibilityLabel', 'Step 1 of 4, Oath, Awaiting start');
  expect(screen.getByTestId('step-node-1-done', hidden)).toContainElement(screen.getByTestId('step-badge-waiting', hidden));
});

test('a withdrawn Oath that never started shows dashed skipped steps, says so, and ends on its result seal', async () => {
  await show(path({ step: 4, steps: ['done', 'skipped', 'skipped', 'current'], badge: 'result' }), 'withdrawn');
  expect(screen.getByTestId('step-track')).toHaveProp('accessibilityLabel', 'Etap 4 z 4, Wynik, Wycofana. Pominięte etapy: Trening, Ocena');
  expect(screen.getByTestId('step-words', hidden)).toHaveTextContent('Wycofana');
  expect(StyleSheet.flatten(screen.getByTestId('step-node-2-skipped', hidden).props.style)).toMatchObject({ borderStyle: 'dashed' });
  expect(screen.getByTestId('step-node-4-current', hidden)).toContainElement(screen.getByTestId('state-seal-withdrawn', hidden));
  expect(screen.queryByTestId(/^step-badge-/, hidden)).toBeNull();
});

test('the workout step draws the Oath activity when given', async () => {
  await show(path({}), 'active', { activityEmblem: 'running' });
  expect(screen.getByTestId('step-node-2-current', hidden)).toContainElement(screen.getByTestId('step-activity', hidden));
});

test.each([[320, 1], [402, 1.4]])('at width %i and text scale %d the track is a vertical list with the badge words', async (width, fontScale) => {
  size(width, fontScale);
  await show(path({ badge: 'interrupted' }), 'active');
  expect(StyleSheet.flatten(screen.getByTestId('step-track').props.style)).toMatchObject({ flexDirection: 'column' });
  expect(screen.getByText('Nie dotarł')).toBeOnTheScreen();
  expect(screen.getByText('Trening').props.numberOfLines).toBeUndefined();
});

test('the compact track is four pips with the short state label', async () => {
  await show(path({ step: 3, steps: ['done', 'done', 'current', 'future'], badge: 'review' }), 'review_pending', { variant: 'compact' });
  const track = screen.getByTestId('step-track');
  expect(track).toHaveProp('accessibilityLabel', 'Etap 3 z 4, Ocena, Pod rozwagą');
  for (const id of ['step-pip-1-done', 'step-pip-2-done', 'step-pip-3-current', 'step-pip-4-future']) {
    expect(StyleSheet.flatten(screen.getByTestId(id, hidden).props.style)).toMatchObject({ width: 8, height: 8 });
  }
  expect(screen.getByText('Pod rozwagą')).toBeOnTheScreen();
  expect(screen.queryByText('Ocena')).toBeNull();
});

test('a compact result names the state', async () => {
  await show(path({ step: 4, steps: ['done', 'done', 'done', 'current'], badge: 'result' }), 'fulfilled', { variant: 'compact', locale: 'en' });
  expect(screen.getByText('Fulfilled')).toBeOnTheScreen();
  expect(screen.getByTestId('step-track')).toHaveProp('accessibilityLabel', 'Step 4 of 4, Result, Fulfilled');
});

test('the compact track speaks its visible state label', async () => {
  await show(path({}), 'active', { variant: 'compact' });
  expect(screen.getByText('Aktywna')).toBeOnTheScreen();
  expect(screen.getByTestId('step-track')).toHaveProp('accessibilityLabel', 'Etap 2 z 4, Trening, Aktywna');
});

test('a vertical result names the state under the result step', async () => {
  size(320, 1);
  await show(path({ step: 4, steps: ['done', 'done', 'done', 'current'], badge: 'result' }), 'missed');
  expect(screen.getByText('Niewykonana')).toBeOnTheScreen();
  expect(screen.getByTestId('step-track')).toHaveProp('accessibilityLabel', 'Etap 4 z 4, Wynik, Niewykonana');
});

test('the vertical list draws one connector per row, from each node to the next row, so growing rows stay joined', async () => {
  size(320, 1);
  await show(path({ badge: 'interrupted' }), 'active');
  for (const row of [1, 2, 3]) expect(StyleSheet.flatten(screen.getByTestId(`step-segment-${row}`, hidden).props.style)).toMatchObject({ position: 'absolute', top: 16, bottom: -12 });
  expect(screen.queryByTestId('step-segment-4', hidden)).toBeNull();
  // Nodes sit at the top of their rows, so a segment always starts at its node centre.
  expect(StyleSheet.flatten(screen.getByTestId('step-row-2', hidden).props.style)).toMatchObject({ alignItems: 'flex-start' });
});
