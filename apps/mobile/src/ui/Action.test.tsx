import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider, useTranslation } from '../localization/LocalizationProvider';
import { Action } from './Action';

function Fixture({ onPress, disabled = false, busy = false }: { onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const { t } = useTranslation();
  return <Action label={t('diagnostics.retry')} onPress={onPress} busy={busy} {...(disabled ? { disabled: true as const, unavailableReason: t('diagnostics.pending') } : { disabled: false as const })} />;
}

test.each([['pl', 'Spróbuj ponownie'], ['en', 'Try again']] as const)('available %s action invokes its callback once', async (locale, name) => {
  const onPress = jest.fn();
  await render(<LocalizationProvider initialLocale={locale}><Fixture onPress={onPress} /></LocalizationProvider>);
  await fireEvent.press(screen.getByRole('button', { name }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('disabled action exposes its reason/state and only activates after re-enabling', async () => {
  const onPress = jest.fn();
  const view = await render(<LocalizationProvider initialLocale="pl"><Fixture onPress={onPress} disabled /></LocalizationProvider>);
  const button = screen.getByRole('button', { name: 'Spróbuj ponownie' });
  expect(screen.getByRole('button', { name: 'Spróbuj ponownie', disabled: true })).toBeOnTheScreen();
  expect(screen.getByText('Sprawdzanie połączenia…')).toBeOnTheScreen();
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  await view.rerender(<LocalizationProvider initialLocale="pl"><Fixture onPress={onPress} /></LocalizationProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('busy action exposes busy state and prevents repeated activation', async () => {
  const onPress = jest.fn();
  const view = await render(<LocalizationProvider initialLocale="en"><Fixture onPress={onPress} busy /></LocalizationProvider>);
  const button = screen.getByRole('button', { name: 'Try again' });
  expect(screen.getByRole('button', { name: 'Try again', busy: true, disabled: true })).toBeOnTheScreen();
  expect(screen.getByText('Working…')).toBeOnTheScreen();
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  await view.rerender(<LocalizationProvider initialLocale="en"><Fixture onPress={onPress} /></LocalizationProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('the label is capped so a long Polish word never breaks inside the button at the largest text', async () => {
  // Native MVP-18 check on iPhone SE 3: "Potwierdź pauzę" broke as "Potwierd / ź" at the largest accessibility size.
  await render(<LocalizationProvider initialLocale="pl"><Fixture onPress={jest.fn()} /></LocalizationProvider>);
  expect(screen.getByText('Spróbuj ponownie').props.maxFontSizeMultiplier).toBeLessThanOrEqual(2.5);
});
