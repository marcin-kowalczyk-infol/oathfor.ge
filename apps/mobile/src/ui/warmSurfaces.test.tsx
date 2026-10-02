import { render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { WallTimePicker } from '../oaths/WallTimePicker';
import { Action } from './Action';
import { GameChoice } from './GameChoice';
import { tokens } from './tokens';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

// MVP-22-B2 (G17), native check: the unselected "W przyszłym terminie", the date, time and zone fields and disabled buttons
// were cool slate on the warm screens. Neutral surfaces use the warm family (G2, G5 and G8 did the same for onboarding and Settings).
const channels = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
const warm = (hex: string) => { const [red, , blue] = channels(hex); return red >= blue + 8; };
const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, string>;
const initial = Dimensions.get('window');
afterEach(() => Dimensions.set({ window: initial, screen: initial }));

test('the neutral surface and the edge under it are warm', () => {
  expect(warm(tokens.color.surface)).toBe(true);
  expect(warm(tokens.warm.edge)).toBe(true);
});

test('an unselected choice and its medallion stand on warm fills', async () => {
  await render(<LocalizationProvider initialLocale="pl"><GameChoice label="W przyszłym terminie" symbol="◷" selected={false} disabled={false} onPress={jest.fn()} /></LocalizationProvider>);
  const choice = flat(screen.getByRole('radio', { name: 'W przyszłym terminie' }).props.style);
  expect(choice).toMatchObject({ backgroundColor: tokens.color.surface, borderBottomColor: tokens.warm.edge });
  expect(flat(screen.getByTestId('choice-medallion').props.style).backgroundColor).toBe(tokens.warm.raised);
});

test('the date, time and zone fields stand on the warm surface', async () => {
  await render(<LocalizationProvider initialLocale="pl"><WallTimePicker field="deadline" value={{ date: '', time: '', zone: 'Europe/Warsaw' }} disabled={false} now={() => Date.parse('2026-10-02T10:00:00Z')} onChange={jest.fn()} /></LocalizationProvider>);
  for (const name of ['Data ukończenia', 'Godzina ukończenia', 'Strefa ukończenia']) {
    expect(flat(screen.getByRole('button', { name }).props.style)).toMatchObject({ backgroundColor: tokens.color.surface, borderBottomColor: tokens.warm.edge });
  }
});

test('a disabled primary button is warm, not slate', async () => {
  await render(<LocalizationProvider initialLocale="pl"><Action label="Zobacz zasady" disabled unavailableReason="Wybierz termin." onPress={jest.fn()} /></LocalizationProvider>);
  expect(flat(screen.getByRole('button', { name: 'Zobacz zasady' }).props.style)).toMatchObject({ backgroundColor: tokens.color.surface, borderBottomColor: tokens.warm.edge });
});
