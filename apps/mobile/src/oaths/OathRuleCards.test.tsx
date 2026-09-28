import { Dimensions } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Snapshot } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathRuleCards } from './OathRuleCards';
import { promiseText } from './SnapshotRules';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

function snapshot(): Snapshot {
  const value = JSON.parse(JSON.stringify(catalog));
  value.activity = 'running'; value.activation = { mode: 'now', time: null };
  value.deadline = { local: '2026-10-02T18:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-02T16:00:00Z', receiptCutoff: '2026-10-02T16:15:00Z' };
  for (const locale of ['pl', 'en']) { value.copy[locale].activity = value.copy[locale].activities.running; delete value.copy[locale].activities; }
  return value;
}
const size = (width: number, fontScale: number) => Dimensions.set({ window: { width, height: 874, scale: 3, fontScale }, screen: { width, height: 874, scale: 3, fontScale } });
afterEach(() => size(402, 1));

test('Polish cards show the promise, declaration and card values, full rules folded', async () => {
  size(402, 1);
  const value = snapshot();
  await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={value} /></LocalizationProvider>);
  expect(screen.getByText(value.copy.pl.declaration)).toBeOnTheScreen();
  expect(screen.getByText(promiseText(value, 'pl'))).toBeOnTheScreen();
  expect(screen.getByTestId('rule-card-deadline')).toHaveTextContent(/Termin.*pt 2 paź 18:00 · Warszawa/);
  expect(screen.getByTestId('rule-cards')).toHaveStyle({ flexDirection: 'row' });
  expect(screen.queryByText(value.copy.pl.sections.appeal)).toBeNull();
});

test.each([[340, 1], [402, 1.4]])('at width %i and text scale %d the cards stack in one column', async (width, fontScale) => {
  size(width, fontScale);
  await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={snapshot()} /></LocalizationProvider>);
  expect(screen.getByTestId('rule-cards')).toHaveStyle({ flexDirection: 'column' });
  expect(screen.getByTestId('rule-card-consequence')).toHaveTextContent(/Nie tracisz zdobytego XP/);
});

test('a highlighted card is marked for the explanation', async () => {
  await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={snapshot()} highlight="cutoff" /></LocalizationProvider>);
  expect(screen.getByTestId('rule-card-cutoff')).toHaveStyle({ borderColor: '#e0a84f' });
  expect(screen.getByTestId('rule-card-deadline')).not.toHaveStyle({ borderColor: '#e0a84f' });
});
