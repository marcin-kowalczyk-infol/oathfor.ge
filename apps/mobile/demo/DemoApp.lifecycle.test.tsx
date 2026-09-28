import { StrictMode } from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DemoApp from './DemoApp';
import messages from '../src/localization/locales/pl/messages.json';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }], getCalendars: () => [{ timeZone: 'Europe/Warsaw' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '40000000-0000-4000-8000-00000000000a' }));
jest.mock('../src/ui/useMotion', () => ({ useMotionAllowed: () => false, MotionSuspended: ({ children }: { children: unknown }) => children }));

const phone = { width: 390, height: 844, scale: 3, fontScale: 1 };
const forge = { name: `${messages.menu.forge}, ${messages.menu.forgeDetail}` };
// Effects may re-run without unmounting (Fast Refresh, StrictMode). The kept runtime must still answer.
test('re-running demo effects keeps character creation, the menu, the room guide and the Oath list working', async () => {
  Dimensions.set({ window: phone, screen: phone });
  await render(<StrictMode><DemoApp /></StrictMode>);
  expect(await screen.findByRole('header', { name: messages.character.title })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(messages.character.name), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: `${messages.character.form.feminine}, ${messages.character.form.feminineDetail}` }));
  await fireEvent.press(screen.getByRole('button', { name: messages.character.create }));
  await fireEvent.press(await screen.findByRole('button', forge));
  // A fresh scenario has no guide flag, so the first room entry starts the guide.
  await fireEvent.press(await screen.findByRole('button', { name: messages.room.guide.skip }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.seals }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.tutorial.next }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.actions.seals }));
  expect(await screen.findByText(messages.oathHome.emptyToday)).toBeOnTheScreen();
  expect(screen.queryByText(messages.oathHome.loadError)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: messages.forge.returnRoom }));
  await fireEvent.press(await screen.findByRole('button', { name: messages.room.door }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.tutorial.next }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.exit }));
  expect(await screen.findByRole('button', forge)).toBeOnTheScreen();
});
