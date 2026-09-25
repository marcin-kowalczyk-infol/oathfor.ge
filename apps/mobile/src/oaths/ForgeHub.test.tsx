import { AccessibilityInfo, AppState, Dimensions, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { ForgeHub } from './ForgeHub';
import { useMotionAllowed } from '../ui/useMotion';

beforeEach(() => {
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } });
});

test('the hearth starts creation and cannot activate while disabled', async () => {
  const onCreate = jest.fn();
  const view = await render(<LocalizationProvider initialLocale="en"><ForgeHub items={[]} onOpen={jest.fn()} onCreate={onCreate} /></LocalizationProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Create an Oath' }));
  expect(onCreate).toHaveBeenCalledTimes(1);
  await view.rerender(<LocalizationProvider initialLocale="en"><ForgeHub items={[]} onOpen={jest.fn()} onCreate={onCreate} createDisabled /></LocalizationProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Create an Oath', disabled: true }));
  expect(onCreate).toHaveBeenCalledTimes(1);
});

test('decorative hearth never offers creation when no callback is provided', async () => {
  await render(<LocalizationProvider initialLocale="en"><ForgeHub items={[]} onOpen={jest.fn()} /></LocalizationProvider>);
  expect(screen.queryByRole('button', { name: 'Create an Oath' })).toBeNull();
});

function MotionProbe() { return <Text>{useMotionAllowed() ? 'motion enabled' : 'motion disabled'}</Text>; }

test('motion stays off before preference lookup, follows foreground and newer accessibility events', async () => {
  let resolve!: (reduced: boolean) => void;
  let preferenceChanged!: (reduced: boolean) => void;
  let stateChanged!: (state: 'active' | 'background') => void;
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  const lookup = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(done => { resolve = done; }));
  const motionListener = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => {
    preferenceChanged = callback as unknown as (reduced: boolean) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
  const appListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    stateChanged = callback as (state: 'active' | 'background') => void;
    return { remove: jest.fn() };
  });
  try {
    await render(<MotionProbe />);
    expect(screen.getByText('motion disabled')).toBeOnTheScreen();
    await act(async () => preferenceChanged(true));
    await act(async () => resolve(false));
    expect(screen.getByText('motion disabled')).toBeOnTheScreen();
    await act(async () => preferenceChanged(false));
    expect(screen.getByText('motion enabled')).toBeOnTheScreen();
    await act(async () => stateChanged('background'));
    expect(screen.getByText('motion disabled')).toBeOnTheScreen();
    await act(async () => stateChanged('active'));
    expect(screen.getByText('motion enabled')).toBeOnTheScreen();
    await act(async () => preferenceChanged(true));
    expect(screen.getByText('motion disabled')).toBeOnTheScreen();
  } finally {
    lookup.mockRestore(); motionListener.mockRestore(); appListener.mockRestore(); AppState.currentState = previousState;
  }
});
