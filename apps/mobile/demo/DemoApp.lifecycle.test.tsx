import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DemoApp from './DemoApp';
import pl from './locales/pl.json';
import messages from '../src/localization/locales/pl/messages.json';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }], getCalendars: () => [{ timeZone: 'Europe/Warsaw' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '40000000-0000-4000-8000-00000000000a' }));
jest.mock('../src/ui/useMotion', () => ({ useMotionAllowed: () => false, MotionSuspended: ({ children }: { children: unknown }) => children }));

// Effects may re-run without unmounting (Fast Refresh, StrictMode). The kept runtime must still answer.
test('re-running demo effects keeps character creation and the Oath list loadable', async () => {
  await render(<StrictMode><DemoApp /></StrictMode>);
  await fireEvent.press(screen.getByRole('button', { name: 'Pomiń wprowadzenie' }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.exit }));
  expect(await screen.findByRole('header', { name: messages.character.title })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(messages.character.name), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: `${messages.character.form.feminine}, ${messages.character.form.feminineDetail}` }));
  await fireEvent.press(screen.getByRole('button', { name: messages.character.create }));
  expect(await screen.findByText(messages.oathHome.emptyToday)).toBeOnTheScreen();
  expect(screen.queryByText(messages.oathHome.loadError)).toBeNull();
});
