import { render, screen } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Snapshot } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { SnapshotRules } from './SnapshotRules';

function snapshot(): Snapshot {
  const value = JSON.parse(JSON.stringify(catalog));
  value.activity = 'running';
  value.activation = { mode: 'now', time: null };
  value.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { value.copy[locale].activity = value.copy[locale].activities.running; delete value.copy[locale].activities; }
  return value as Snapshot;
}

test('renders stored Polish rules and committed deadline with seconds, zone and offset', async () => {
  const value = snapshot();
  await render(<LocalizationProvider initialLocale="pl"><SnapshotRules snapshot={value} /></LocalizationProvider>);
  expect(screen.getByRole('header', { name: value.copy.pl.title })).toBeOnTheScreen();
  expect(screen.getByText(value.copy.pl.sections.evidence)).toBeOnTheScreen();
  expect(screen.getAllByText(/02:30:00.*Europe\/Warsaw.*\+02:00/).length).toBeGreaterThan(0);
});

test.each(['pl', 'en'] as const)('%s renders every stored rule section and substitutes promise exactly', async locale => {
  const value = snapshot();
  await render(<LocalizationProvider initialLocale={locale}><SnapshotRules snapshot={value} /></LocalizationProvider>);
  expect(screen.getByText(value.copy[locale].subtitle)).toBeOnTheScreen();
  expect(screen.getByText(value.copy[locale].declaration)).toBeOnTheScreen();
  for (const text of Object.values(value.copy[locale].sections)) expect(screen.getByText(text)).toBeOnTheScreen();
  expect(screen.getByText(value.copy[locale].activity)).toBeOnTheScreen();
  expect(screen.queryByText(/\{activity\}|\{deadline\}/)).toBeNull();
  expect(screen.getByText(/02:45:00.*Europe\/Warsaw.*UTC\+02:00/)).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
});

test('shows the second repeated occurrence distinctly and keeps scheduled activation in its own zone', async () => {
  const value = snapshot();
  value.deadline.offset = '+01:00'; value.deadline.utc = '2026-10-25T01:30:00Z'; value.deadline.receiptCutoff = '2026-10-25T01:45:00Z';
  value.activation = { mode: 'scheduled', time: { local: '2026-10-24T23:00:00', timezone: 'UTC', offset: '+00:00', explicitOffset: false, utc: '2026-10-24T23:00:00Z' } };
  await render(<LocalizationProvider initialLocale="en"><SnapshotRules snapshot={value} /></LocalizationProvider>);
  expect(screen.getAllByText(/02:30:00.*Europe\/Warsaw.*UTC\+01:00/).length).toBeGreaterThan(0);
  expect(screen.getByText(/02:45:00.*Europe\/Warsaw.*UTC\+01:00/)).toBeOnTheScreen();
  expect(screen.getByText(/23:00:00.*UTC.*UTC\+00:00/)).toBeOnTheScreen();
});

test('receipt cutoff uses its actual offset when the grace window crosses a DST change', async () => {
  const value = snapshot();
  value.deadline.local = '2026-10-25T02:55:00'; value.deadline.utc = '2026-10-25T00:55:00Z'; value.deadline.receiptCutoff = '2026-10-25T01:10:00Z';
  await render(<LocalizationProvider initialLocale="pl"><SnapshotRules snapshot={value} /></LocalizationProvider>);
  expect(screen.getAllByText(/02:55:00.*Europe\/Warsaw.*UTC\+02:00/).length).toBeGreaterThan(0);
  expect(screen.getByText(/02:10:00.*Europe\/Warsaw.*UTC\+01:00/)).toBeOnTheScreen();
});

test('unsupported device timezone still shows stored deadline and an explicitly UTC cutoff', async () => {
  const value = snapshot(); value.deadline.timezone = 'DUMMY/Unsupported';
  await render(<LocalizationProvider initialLocale="en"><SnapshotRules snapshot={value} /></LocalizationProvider>);
  expect(screen.getAllByText(/02:30:00.*DUMMY\/Unsupported.*UTC\+02:00/).length).toBeGreaterThan(0);
  expect(screen.getByText(/00:45:00 · UTC\+00:00/)).toBeOnTheScreen();
});
