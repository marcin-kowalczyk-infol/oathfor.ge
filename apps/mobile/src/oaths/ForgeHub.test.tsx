import { AccessibilityInfo, AppState, Dimensions, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { ForgeHub } from './ForgeHub';
import { useMotionAllowed } from '../ui/useMotion';
import type { Oath } from '../api/oathSchema';
import { createServerClock } from './serverClock';

beforeEach(() => {
  // The motion test below restores these spies, so every test starts from a working listener pair.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
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

const sealOath = (state: string) => ({
  id: `oath-${state}`, state, review: null,
  snapshot: { activity: 'run', copy: { en: { activity: 'Running' }, pl: { activity: 'Bieganie' } }, activation: { mode: 'now', time: { utc: '2026-09-28T08:00:00Z' } }, deadline: { local: '2026-09-29T00:46:00', timezone: 'Europe/Warsaw', utc: '2026-09-28T22:46:00Z' } },
}) as unknown as Oath;

test('a seal names its state in one short line while the button speaks the full state', async () => {
  await render(<LocalizationProvider initialLocale="pl"><ForgeHub items={[sealOath('review_pending'), sealOath('needs_more_evidence')]} onOpen={jest.fn()} /></LocalizationProvider>);
  expect(screen.getByText('Rozpatrywana')).toHaveProp('numberOfLines', 1);
  expect(screen.getByText('Do uzupełnienia')).toHaveProp('numberOfLines', 1);
  expect(screen.getAllByTestId('forge-seal')[0]).toHaveProp('accessibilityLabel', expect.stringContaining('W trakcie rozpatrywania'));
});

test('seal countdowns stack the label over one unbroken value', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-09-28T19:00:30Z'));
  try {
    const clock = createServerClock(); clock.observe(new Date(Date.now()).toISOString());
    await render(<LocalizationProvider initialLocale="pl"><ForgeHub items={[sealOath('active')]} onOpen={jest.fn()} clock={clock} /></LocalizationProvider>);
    expect(screen.getByTestId('countdown-chip')).toHaveStyle({ flexDirection: 'column', alignSelf: 'stretch' });
    expect(screen.getByText('Do terminu')).toHaveProp('numberOfLines', 1);
    expect(screen.getByText('3 h 45 min')).toHaveProp('numberOfLines', 1);
  } finally { jest.useRealTimers(); }
});

// Native check, 2026-09-30: a lone featured seal stretched its countdown chip across almost the whole 402 pt screen.
test.each([1, 2, 3])('at seal count %i every column keeps the three-seal width and the row stays centred', async count => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-09-28T19:00:30Z'));
  try {
    const clock = createServerClock(); clock.observe(new Date(Date.now()).toISOString());
    const items = Array.from({ length: count }, (_, i) => ({ ...sealOath('active'), id: `oath-${i}` }) as Oath);
    await render(<LocalizationProvider initialLocale="en"><ForgeHub items={items} onOpen={jest.fn()} clock={clock} /></LocalizationProvider>);
    const columns = screen.getAllByTestId('forge-seal-column');
    expect(columns).toHaveLength(count);
    // A third of a row widened by the 8 pt gap, less 4 pt on each side, is exactly one of three columns with an 8 pt gap between them.
    for (const column of columns) {
      expect(column).toHaveStyle({ width: `${100 / 3}%`, paddingHorizontal: 4 });
      expect(column).not.toHaveStyle({ flex: 1 });
    }
    expect(screen.getByTestId('forge-seals')).toHaveStyle({ flexDirection: 'row', justifyContent: 'center', marginHorizontal: -4 });
    expect(screen.getAllByTestId('countdown-chip')).toHaveLength(count);
  } finally { jest.useRealTimers(); }
});
