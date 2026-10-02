import { Dimensions } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Snapshot } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { promiseText, SnapshotRules } from './SnapshotRules';

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

// MVP-22-G24: drawn Polish rules keep a single-letter word with the next word. Binding happens at render, the stored snapshot stays as it is.
// MVP-22-G24b: the dot before the offset starts the next line with it, so "02:30 ·" never ends a line.
test('Polish rules bind single-letter words at render without changing the stored snapshot', async () => {
  const value = snapshot();
  const stored = JSON.parse(JSON.stringify(value));
  const raw = { normalizer: (text: string) => text };
  await render(<LocalizationProvider initialLocale="pl"><SnapshotRules snapshot={value} /></LocalizationProvider>);
  expect(screen.getByText(/^Ukończę trening: Bieganie, do 25 października 2026 o 02:30 ·\u00a0UTC\+2\. .*zdjęcie lub zrzut ekranu zgodnie z zasadami/, raw)).toBeOnTheScreen();
  expect(screen.getByText(/^Przy składaniu dowodu wybierzesz zdjęcie kontekstu albo zapis aktywności i potwierdzisz/, raw)).toBeOnTheScreen();
  expect(screen.getByText('Rozpoczęcie i zobowiązanie', raw)).toBeOnTheScreen();
  expect(screen.getByText('Teraz, w chwili potwierdzenia na serwerze', raw)).toBeOnTheScreen();
  expect(value).toEqual(stored);
});

test('English rules keep ordinary spaces around single-letter words', async () => {
  const raw = { normalizer: (text: string) => text };
  await render(<LocalizationProvider initialLocale="en"><SnapshotRules snapshot={snapshot()} /></LocalizationProvider>);
  expect(screen.getByText('Now, at server confirmation', raw)).toBeOnTheScreen();
  expect(screen.getByText(/^I will complete my workout: Running, by October 25, 2026 at 02:30 ·\u00a0UTC\+2\. I will confirm completion and submit a photo/, raw)).toBeOnTheScreen();
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

test('the promise names the deadline to the minute with a short UTC offset, the full rules keep zone and seconds', () => {
  const value = snapshot();
  expect(promiseText(value, 'pl')).toContain('25 października 2026 o 02:30 · UTC+2.');
  expect(promiseText(value, 'en')).toContain('October 25, 2026 at 02:30 · UTC+2.');
  expect(promiseText(value, 'en')).not.toMatch(/Europe\/Warsaw|02:30:00/);
  value.deadline.offset = '+05:30'; expect(promiseText(value, 'en')).toContain('· UTC+5:30.');
  value.deadline.offset = '-03:00'; expect(promiseText(value, 'en')).toContain('· UTC-3.');
  value.deadline.offset = '+00:00'; expect(promiseText(value, 'en')).toContain('· UTC.');
});

// Native check, 2026-09-30, iPhone 18 Pro at the largest accessibility size in Polish: uncapped text on the parchment broke
// "października", "zaplanowany" and "Nierozstrzygnięta" mid-word. The display cap keeps the longest words whole at 402 and 375 points.
describe.each([402, 375])('at %s points and the largest text size', width => {
  const initial = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
  afterEach(() => Dimensions.set(initial));
  test('every text on the parchment is capped at the display size', async () => {
    const phone = { width, height: 874, scale: 3, fontScale: 3.571 };
    Dimensions.set({ window: phone, screen: phone });
    const value = snapshot();
    await render(<LocalizationProvider initialLocale="pl"><SnapshotRules snapshot={value} /></LocalizationProvider>);
    const capped = [promiseText(value, 'pl'), value.copy.pl.subtitle, value.copy.pl.activity, value.copy.pl.declaration, ...Object.values(value.copy.pl.sections)];
    for (const text of capped) expect(screen.getByText(text)).toHaveProp('maxFontSizeMultiplier', 2);
    for (const node of screen.getAllByText(/Europe\/Warsaw/)) expect(node).toHaveProp('maxFontSizeMultiplier', 2);
    expect(screen.getByText('Teraz, w chwili potwierdzenia na serwerze')).toHaveProp('maxFontSizeMultiplier', 2);
  });
});
