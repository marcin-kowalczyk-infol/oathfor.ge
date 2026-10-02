import { fireEvent, render, screen, within } from '@testing-library/react-native';
import DemoApp from './DemoApp';
import pl from './locales/pl.json';
import en from './locales/en.json';
import messages from '../src/localization/locales/pl/messages.json';
// A passthrough that keeps each DUMMY scenario, so a control test can check the data it changed.
const mockDummies: Array<ReturnType<typeof import('./runtime').createDummy>> = [];
jest.mock('./runtime', () => {
  const actual = jest.requireActual('./runtime');
  return { ...actual, createDummy: (...args: Parameters<typeof actual.createDummy>) => { const dummy = actual.createDummy(...args); mockDummies.push(dummy); return dummy; } };
});
const mockProductInsets: unknown[] = [];
jest.mock('../src/auth/AuthScreen', () => ({ AuthScreen: ({ guideStorage, profileApi }: any) => {
  const React = require('react'); const { TextInput, Text } = require('react-native');
  mockProductInsets.push(React.useContext(require('react-native-safe-area-context').SafeAreaInsetsContext));
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

// The badge bar takes the top inset only. The product below it reads its insets from its own provider,
// which on a device starts under the bar, so its screens get no second top inset.
test('the badge bar keeps the top inset and the product has its own safe area provider', async () => {
  await render(<DemoApp />);
  expect(screen.getByTestId('demo-badge-bar').props.edges).toEqual({ top: 'additive', left: 'additive', right: 'additive', bottom: 'off' });
  expect(mockProductInsets[mockProductInsets.length - 1]).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
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

test('a control arms one lost acceptance record clear for checking a confirmed Oath with a kept record', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  const dummy = mockDummies.at(-1)!;
  expect(screen.queryByText(pl.recordClearArmed)).toBeNull();
  expect(dummy.state.loseNextRecordClear).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: pl.loseRecordClear }));
  expect(screen.getByText(pl.recordClearArmed)).toBeOnTheScreen();
  expect(dummy.state.loseNextRecordClear).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByRole('button', { name: en.loseRecordClear })).toBeOnTheScreen();
  expect(screen.getByText(en.recordClearArmed)).toBeOnTheScreen();
});

const accountId = '10000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-000000000001';
const sections = ['sectionScenarios', 'sectionLanguage', 'sectionFailures', 'sectionAdd', 'sectionTools'] as const;
const actions = ['new', 'empty', 'returning', 'offline', 'expire', 'lose', 'loseProof', 'loseRecordClear', 'add', 'addNeedsMore', 'restart', 'close'] as const;
// Owner feedback 2026-10-02: every control says what it simulates, and the controls sit under short headers.
test.each([['pl', pl], ['en', en]] as const)('the %s controls show every header, action and hint', async (locale, copy) => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  if (locale === 'en') await fireEvent.press(screen.getByRole('button', { name: 'English' }));
  for (const key of sections) expect(screen.getByRole('header', { name: copy[key] })).toBeOnTheScreen();
  for (const key of actions) expect(screen.getByRole('button', { name: copy[key] })).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: copy.wireCheck })).toBeOnTheScreen();
  expect(screen.getByText(copy.resetHint)).toBeOnTheScreen();
  expect(screen.getByText(copy.addHint)).toBeOnTheScreen();
});

// A one-shot failure shows its armed line inside the control's own group, right under the button,
// and the button keeps its plain label so it can still be found and pressed.
test.each([
  ['lose', 'armed', 'loseNext'],
  ['loseProof', 'proofArmed', 'loseNextProof'],
  ['loseRecordClear', 'recordClearArmed', 'loseNextRecordClear'],
] as const)('arming %s shows the armed line next to its button', async (key, armedKey, flag) => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  const group = screen.getByTestId(`demo-control-${key}`);
  expect(within(group).queryByText(pl[armedKey])).toBeNull();
  await fireEvent.press(within(group).getByRole('button', { name: pl[key] }));
  expect(mockDummies.at(-1)!.state[flag]).toBe(true);
  expect(within(screen.getByTestId(`demo-control-${key}`)).getByRole('alert')).toHaveTextContent(pl[armedKey]);
  for (const other of ['lose', 'loseProof', 'loseRecordClear'].filter(name => name !== key)) {
    expect(within(screen.getByTestId(`demo-control-${other}`)).queryByRole('alert')).toBeNull();
  }
});

test('the armed line stays until the runtime spends the failure', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByRole('button', { name: pl.loseRecordClear }));
  await fireEvent.press(screen.getByRole('button', { name: pl.close }));
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  expect(within(screen.getByTestId('demo-control-loseRecordClear')).getByText(pl.recordClearArmed)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: pl.close }));
  // The next clear of the device acceptance record spends the flag, as after a confirmed Oath.
  const runtime = mockDummies.at(-1)!.runtime();
  expect(await runtime.acceptanceStorage.write(accountId, characterId, null)).toEqual({ kind: 'unavailable' });
  runtime.controller.dispose();
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  expect(screen.queryByText(pl.recordClearArmed)).toBeNull();
});

test('a scenario reset clears every armed line', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByRole('button', { name: pl.lose }));
  await fireEvent.press(screen.getByRole('button', { name: pl.loseProof }));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  await fireEvent.press(screen.getByRole('button', { name: pl.returning }));
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  expect(screen.queryAllByRole('alert')).toHaveLength(0);
  expect(screen.queryByText(pl.armed)).toBeNull();
  expect(screen.queryByText(pl.proofArmed)).toBeNull();
});

test('the offline control switches to the reconnect label and back', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByRole('button', { name: pl.offline }));
  expect(mockDummies.at(-1)!.state.offline).toBe(true);
  expect(screen.queryByRole('button', { name: pl.offline })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: pl.online }));
  expect(mockDummies.at(-1)!.state.offline).toBe(false);
  expect(screen.getByRole('button', { name: pl.offline })).toBeOnTheScreen();
});

test('a control adds a needs-more-proof Oath and closes the controls', async () => {
  await render(<DemoApp />);
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.returning));
  // The returning scenario is a new DUMMY, so its Oaths are counted after the reset.
  const dummy = mockDummies.at(-1)!;
  const before = dummy.state.oaths.length;
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.addNeedsMore));
  expect(screen.queryByText(pl.addNeedsMore)).toBeNull();
  expect(dummy.state.oaths).toHaveLength(before + 1);
  expect(dummy.state.oaths.at(-1)!.state).toBe('needs_more_evidence');
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
