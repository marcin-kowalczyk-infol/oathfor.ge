import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Disclosure } from './Disclosure';

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
