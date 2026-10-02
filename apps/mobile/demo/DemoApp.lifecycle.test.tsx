import { StrictMode } from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DemoApp from './DemoApp';
import messages from '../src/localization/locales/pl/messages.json';
import { expectConsole } from '../jest/consoleGuard';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }], getCalendars: () => [{ timeZone: 'Europe/Warsaw' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '40000000-0000-4000-8000-00000000000a' }));
jest.mock('../src/ui/useMotion', () => ({ useMotionAllowed: () => false, MotionSuspended: ({ children }: { children: unknown }) => children }));

const phone = { width: 390, height: 844, scale: 3, fontScale: 1 };
const forge = { name: `${messages.menu.forge}, ${messages.menu.forgeDetail}` };
// Effects may re-run without unmounting (Fast Refresh, StrictMode). The kept runtime must still answer.
test('re-running demo effects keeps character creation, the menu, the room gate and the Oath screens working', async () => {
  Dimensions.set({ window: phone, screen: phone });
  // Allowed on purpose, test-only. The Oath screens' native-driven scroll event makes React Native's Animated call
  // findNodeHandle on its view. The jest preset's View is a class component, so under StrictMode React reports it.
  // On a device View is a host component and nothing is reported. Removing the native module breaks Animated in jest.
  expectConsole('error', /^findNodeHandle is deprecated in StrictMode\. findNodeHandle was passed an instance of View/);
  await render(<StrictMode><DemoApp /></StrictMode>);
  expect(await screen.findByRole('header', { name: messages.character.title })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(messages.character.name), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: `${messages.character.form.feminine}, ${messages.character.form.feminineDetail}` }));
  await fireEvent.press(screen.getByRole('button', { name: messages.character.create }));
  await fireEvent.press(await screen.findByRole('button', forge));
  // A fresh scenario has no guide flag, so the first room entry plays Żaromir's start bark (MVP-22-E2.2).
  expect(await screen.findByText(messages.room.gate.start)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: messages.room.dismiss }));
  // With no current Oath the seals are unlit: a bark and no action.
  await fireEvent.press(screen.getByRole('button', { name: `${messages.room.seals}, ${messages.room.gate.inactive.seals}` }));
  expect(screen.getByText(messages.room.gate.seals)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: messages.room.actions.seals })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: messages.room.hearth }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.tutorial.next }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.actions.hearth }));
  expect(await screen.findByRole('button', { name: messages.forge.returnRoom })).toBeOnTheScreen();
  expect(screen.queryByText(messages.oathHome.loadError)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: messages.forge.returnRoom }));
  await fireEvent.press(await screen.findByRole('button', { name: messages.room.door }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.tutorial.next }));
  await fireEvent.press(screen.getByRole('button', { name: messages.room.exit }));
  expect(await screen.findByRole('button', forge)).toBeOnTheScreen();
});
