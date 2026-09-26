import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DemoApp from './DemoApp';
import pl from './locales/pl.json';
import messages from '../src/localization/locales/pl/messages.json';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }], getCalendars: () => [{ timeZone: 'Europe/Warsaw' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../src/ui/useMotion', () => ({ useMotionAllowed: () => false, MotionSuspended: ({ children }: { children: unknown }) => children }));

// Effects may re-run without unmounting (Fast Refresh, StrictMode). The kept runtime must still answer.
test('re-running demo effects keeps the Oath list loadable', async () => {
  await render(<StrictMode><DemoApp /></StrictMode>);
  await fireEvent.press(screen.getByRole('button', { name: 'Pomiń wprowadzenie' }));
  await fireEvent.press(screen.getByRole('button', { name: pl.scene.exit }));
  expect(await screen.findByText(messages.oathHome.emptyToday)).toBeOnTheScreen();
  expect(screen.queryByText(messages.oathHome.loadError)).toBeNull();
});
