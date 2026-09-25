import { fireEvent, render, screen } from '@testing-library/react-native';
import DemoApp from './DemoApp';
import pl from './locales/pl.json';
jest.mock('../src/ui/useMotion', () => ({ useMotionAllowed: () => false }));
jest.mock('../src/auth/AuthScreen', () => ({ AuthScreen: ({ forgeNavigation }: any) => {
  const React = require('react'); const { TextInput, Button, Text } = require('react-native');
  const [draft, setDraft] = React.useState('');
  return <><TextInput accessibilityLabel="Preserved draft" value={draft} onChangeText={setDraft} /><Button title="Return to room" onPress={forgeNavigation.onReturn} /><Text>{`Request: ${forgeNavigation.request?.target ?? 'none'}`}</Text></>;
} }));
test('first visit guide stays dismissed on reopening and can be replayed', async () => {
  await render(<DemoApp />);
  expect(screen.getByText('Żaromir')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Pomiń wprowadzenie' }));
  await fireEvent.press(screen.getByRole('button', { name: pl.scene.exit }));
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.sceneOpen));
  expect(screen.queryByText('Żaromir')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText('Żaromir · pokaż miejsca ponownie'));
  expect(screen.getByText('Żaromir')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Pomiń wprowadzenie' }));
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.empty));
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.sceneOpen));
  expect(screen.getByText('Żaromir')).toBeOnTheScreen();
});

test('return to the spatial room keeps the functional app mounted and hidden from accessibility', async () => {
  await render(<DemoApp />);
  expect(screen.queryByLabelText('Preserved draft')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Pomiń wprowadzenie' }));
  await fireEvent.press(screen.getByRole('button', { name: pl.scene.exit }));
  await fireEvent.changeText(screen.getByLabelText('Preserved draft'), 'Uncommitted workout');
  await fireEvent.press(screen.getByRole('button', { name: 'Return to room' }));
  expect(screen.queryByLabelText('Preserved draft')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: pl.scene.exit }));
  expect(screen.getByLabelText('Preserved draft').props.value).toBe('Uncommitted workout');
});

test('a remounted functional app does not replay the last room destination', async () => {
  await render(<DemoApp />);
  expect(screen.getByText('Request: none', { includeHiddenElements: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Pomiń wprowadzenie' }));
  await fireEvent.press(screen.getByRole('button', { name: pl.scene.chronicle }));
  await fireEvent.press(screen.getByRole('button', { name: pl.scene.actions.chronicle }));
  expect(screen.getByText('Request: history')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: pl.badge }));
  await fireEvent.press(screen.getByText(pl.restart));
  expect(screen.getByText('Request: none')).toBeOnTheScreen();
});
