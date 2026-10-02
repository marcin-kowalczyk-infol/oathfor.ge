import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Disclosure } from './Disclosure';
import { LocalizationProvider } from '../localization/LocalizationProvider';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

test('the label names what opens, and pressing it shows and hides the content', async () => {
  await render(<Disclosure label="Pełny opis"><Text>Dowód odebrany o 18:05.</Text></Disclosure>);
  const toggle = screen.getByRole('button', { name: 'Pełny opis' });
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  expect(screen.queryByText('Dowód odebrany o 18:05.')).toBeNull();

  await fireEvent.press(toggle);
  expect(screen.getByRole('button', { name: 'Pełny opis' })).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  expect(screen.getByText('Dowód odebrany o 18:05.')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Pełny opis' }));
  expect(screen.getByRole('button', { name: 'Pełny opis' })).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  expect(screen.queryByText('Dowód odebrany o 18:05.')).toBeNull();
});

test('the target is at least 44 pt and the label wraps instead of being cut', async () => {
  await render(<Disclosure label="Pełne zasady"><Text>Treść</Text></Disclosure>);
  expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Pełne zasady' }).props.style).minHeight).toBeGreaterThanOrEqual(44);
  const label = screen.getByText('Pełne zasady');
  expect(label.props.numberOfLines).toBeUndefined();
  expect(label.props.maxFontSizeMultiplier).toBe(2.5);
});

// MVP-22-B2b (review finding): a heading fold is one element for VoiceOver. The toggle itself is the header, with its
// expanded state and a hint that it opens, so the rotor finds the chapter and the label is not read twice.
test.each([
  ['pl', 'Rozwija lub zwija tę część.'],
  ['en', 'Expands or collapses this section.'],
] as const)('a %s heading fold puts the header role, the state and the hint on the toggle', async (locale, hint) => {
  await render(<LocalizationProvider initialLocale={locale}><Disclosure label="Palenisko" heading><Text>Treść</Text></Disclosure></LocalizationProvider>);
  const toggle = screen.getByRole('header', { name: 'Palenisko' });
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  expect(toggle).toHaveProp('accessibilityHint', hint);
  expect(screen.getAllByRole('header')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Palenisko' })).toBeNull();
  expect(screen.getByText('Palenisko').props.maxFontSizeMultiplier).toBe(2);
  await fireEvent.press(toggle);
  expect(screen.getByRole('header', { name: 'Palenisko' })).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  expect(screen.getByText('Treść')).toBeOnTheScreen();
});

test('a plain fold stays a button without the heading hint', async () => {
  await render(<LocalizationProvider initialLocale="en"><Disclosure label="Full description"><Text>Treść</Text></Disclosure></LocalizationProvider>);
  expect(screen.getByRole('button', { name: 'Full description' })).not.toHaveProp('accessibilityHint', 'Expands or collapses this section.');
  expect(screen.queryAllByRole('header')).toHaveLength(0);
});
