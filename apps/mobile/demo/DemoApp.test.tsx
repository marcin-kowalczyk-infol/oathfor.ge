import { fireEvent, render, screen } from '@testing-library/react-native';
import DemoApp from './DemoApp';
import pl from './locales/pl.json';
import en from './locales/en.json';
import messages from '../src/localization/locales/pl/messages.json';
jest.mock('../src/auth/AuthScreen', () => ({ AuthScreen: ({ guideStorage, profileApi }: any) => {
  const React = require('react'); const { TextInput, Text } = require('react-native');
  const [draft, setDraft] = React.useState('');
  const [locale, setLocale] = React.useState('');
  React.useEffect(() => { void profileApi.get('A'.repeat(43)).then((result: any) => setLocale(result.value.profile.locale)); }, [profileApi]);
  return <><TextInput accessibilityLabel="Preserved draft" value={draft} onChangeText={setDraft} /><Text>{`Guide storage: ${typeof guideStorage?.read}`}</Text><Text>{`Profile locale: ${locale}`}</Text></>;
} }));

test('the app owns the room, so the demo shows no room of its own and passes a guide storage', async () => {
  await render(<DemoApp />);
  expect(screen.queryByRole('button', { name: messages.room.door })).toBeNull();
  expect(screen.getByText('Guide storage: function')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  expect(screen.getByText(pl.empty)).toBeOnTheScreen();
  expect(screen.queryByText(/prototyp/)).toBeNull();
});

test('restarting the interface remounts the app', async () => {
  await render(<DemoApp />);
  await fireEvent.changeText(screen.getByLabelText('Preserved draft'), 'Uncommitted workout');
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.restart));
  expect(screen.getByLabelText('Preserved draft').props.value).toBe('');
});

test('the language control relabels the controls and restarts the app with that profile language', async () => {
  await render(<DemoApp />);
  expect(await screen.findByText('Profile locale: pl')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByRole('button', { name: 'English' }));
  await fireEvent.press(screen.getByText(en.close));
  expect(await screen.findByText('Profile locale: en')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: en.badge })).toBeOnTheScreen();
});

test('a control arms one lost proof reply for checking an interrupted upload', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  expect(screen.queryByText(pl.proofArmed)).toBeNull();
  await fireEvent.press(screen.getByText(pl.loseProof));
  expect(screen.getByText(pl.proofArmed)).toBeOnTheScreen();
});

test('a control adds a needs-more-proof Oath and closes the controls', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.returning));
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.addNeedsMore));
  expect(screen.queryByText(pl.addNeedsMore)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText(en.addNeedsMore)).toBeOnTheScreen();
});

test('the DUMMY wire check switch shows the capture address and survives a scenario change', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  const toggle = () => screen.getByRole('switch', { name: pl.wireCheck });
  expect(toggle()).not.toBeChecked();
  await fireEvent.press(toggle());
  expect(toggle()).toBeChecked();
  expect(screen.getByText(`${pl.wireCheckNotice} http://127.0.0.1:18099`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByText(pl.returning));
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  expect(toggle()).toBeChecked();
  await fireEvent.press(toggle());
  expect(toggle()).not.toBeChecked();
  expect(screen.queryByText(/127\.0\.0\.1/)).toBeNull();
});
