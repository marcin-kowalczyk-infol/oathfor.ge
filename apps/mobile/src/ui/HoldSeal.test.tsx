import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, AppState } from 'react-native';
import { ArtSetProvider } from '../art/ArtProvider';
import { currentArt } from '../art/current';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { HoldSeal, HOLD_MS, type HoldSealProps } from './HoldSeal';

// The hold control of the rules review (docs/product/engagement.md E3, D-E1, D-E5).
const declaration = 'Ćwiczę 20 minut i wyślę zdjęcie.';
const plName = `${declaration} Złóż Przysięgę`;
const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 240 } } };
const touch = (pageX: number, pageY: number) => ({ nativeEvent: { pageX, pageY, locationX: pageX - 40, locationY: pageY - 400, timestamp: 0, touches: [], changedTouches: [] } });

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  // The preset's AccessibilityInfo functions are already jest.fn, so restoreAllMocks keeps a resolved value set here.
  for (const name of ['isScreenReaderEnabled', 'isReduceMotionEnabled'] as const) (AccessibilityInfo[name] as unknown as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

type Extra = Partial<Omit<HoldSealProps, 'declaration' | 'onSeal'>>;
async function show(props: Extra = {}, locale: 'pl' | 'en' = 'pl') {
  const onSeal = jest.fn();
  // A merged spread loses the disabled and unavailableReason pairing, which each test keeps itself.
  const element = (extra: Extra = {}) => <LocalizationProvider initialLocale={locale}><HoldSeal {...{ declaration, onSeal, ...props, ...extra } as HoldSealProps} /></LocalizationProvider>;
  const view = await render(element());
  // The motion and screen reader preferences arrive as promises after mount.
  await act(async () => {});
  const target = screen.getByTestId('hold-seal');
  await fireEvent(target, 'layout', layout);
  return { onSeal, target, rerender: (extra: Extra) => view.rerender(element(extra)) };
}
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
const press = (target: ReturnType<typeof screen.getByTestId>) => fireEvent(target, 'responderGrant', touch(190, 460));
const release = (target: ReturnType<typeof screen.getByTestId>) => fireEvent(target, 'responderRelease', touch(190, 460));

test('the hold lasts one second', () => {
  expect(HOLD_MS).toBe(1000);
});

test('an early release at 0.6 s does not seal and the ring empties', async () => {
  const { onSeal, target } = await show();
  await press(target);
  expect(screen.getByTestId('hold-seal-holding', { includeHiddenElements: true })).toBeTruthy();
  await advance(600);
  await release(target);
  await advance(1000);
  expect(onSeal).not.toHaveBeenCalled();
  expect(screen.getByTestId('hold-seal-idle', { includeHiddenElements: true })).toBeTruthy();
});

test('a full hold seals once on release, never on the full ring alone, and the next hold starts empty', async () => {
  const { onSeal, target } = await show();
  await press(target);
  await advance(HOLD_MS);
  expect(screen.getByTestId('hold-seal-full', { includeHiddenElements: true })).toBeTruthy();
  await advance(2000);
  expect(onSeal).not.toHaveBeenCalled();
  await release(target);
  expect(onSeal).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('hold-seal-idle', { includeHiddenElements: true })).toBeTruthy();
  await release(target);
  expect(onSeal).toHaveBeenCalledTimes(1);
  await press(target);
  await advance(HOLD_MS - 1);
  await release(target);
  expect(onSeal).toHaveBeenCalledTimes(1);
});

test('sliding out of the target after a full hold cancels, also when the finger comes back', async () => {
  const { onSeal, target } = await show();
  await press(target);
  await advance(HOLD_MS);
  await fireEvent(target, 'responderMove', touch(190, 460 + 400));
  expect(screen.getByTestId('hold-seal-idle', { includeHiddenElements: true })).toBeTruthy();
  await fireEvent(target, 'responderMove', touch(190, 460));
  await release(target);
  expect(onSeal).not.toHaveBeenCalled();
});

test('a move inside the target keeps the hold', async () => {
  const { onSeal, target } = await show();
  await press(target);
  await fireEvent(target, 'responderMove', touch(200, 470));
  await advance(HOLD_MS);
  await release(target);
  expect(onSeal).toHaveBeenCalledTimes(1);
});

test('a scroll that takes the touch cancels the hold', async () => {
  const { onSeal, target } = await show();
  await press(target);
  await advance(HOLD_MS);
  expect(target.props.onResponderTerminationRequest()).toBe(true);
  await fireEvent(target, 'responderTerminate', touch(190, 460));
  await release(target);
  expect(onSeal).not.toHaveBeenCalled();
});

test('the activate action seals once, as the VoiceOver double tap and Switch Control select', async () => {
  const { onSeal, target } = await show();
  expect(target.props.accessibilityActions).toEqual([{ name: 'activate' }]);
  await fireEvent(target, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  expect(onSeal).toHaveBeenCalledTimes(1);
});

test('busy ignores presses and activate, and says it is working', async () => {
  const { onSeal, target } = await show({ busy: true });
  expect(screen.getByRole('button', { name: plName, busy: true, disabled: true })).toBeOnTheScreen();
  expect(screen.getByText('Trwa przetwarzanie…')).toBeOnTheScreen();
  await press(target);
  await advance(HOLD_MS);
  await release(target);
  await fireEvent(target, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  expect(onSeal).not.toHaveBeenCalled();
  expect(target.props.accessibilityActions).toEqual([{ name: 'activate' }]);
});

test('turning busy during a hold cancels it', async () => {
  const { onSeal, target, rerender } = await show();
  await press(target);
  await advance(HOLD_MS);
  await rerender({ busy: true });
  await rerender({ busy: false });
  await release(target);
  expect(onSeal).not.toHaveBeenCalled();
});

test('disabled ignores presses and activate and draws its reason', async () => {
  const { onSeal, target } = await show({ disabled: true, unavailableReason: 'Najpierw wybierz termin.' });
  expect(screen.getByRole('button', { name: plName, disabled: true })).toBeOnTheScreen();
  expect(screen.getByText('Najpierw wybierz termin.')).toBeOnTheScreen();
  expect(target).toHaveProp('accessibilityHint', 'Najpierw wybierz termin.');
  await press(target);
  await advance(HOLD_MS);
  await release(target);
  await fireEvent(target, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  expect(onSeal).not.toHaveBeenCalled();
});

test.each([
  ['pl', plName, 'Przytrzymaj, by złożyć Przysięgę', 'Stuknij dwukrotnie, by złożyć Przysięgę'],
  ['en', `${declaration} Commit to the Oath`, 'Hold to commit to the Oath', 'Double-tap to commit to the Oath'],
] as const)('%s: the button is the declaration plus the action, the drawn hint names the hold', async (locale, name, hold, tap) => {
  const { target } = await show({}, locale);
  expect(screen.getByRole('button', { name })).toBe(target);
  expect(screen.getByText(declaration)).toHaveProp('budget', 'declaration');
  expect(screen.getByText(hold)).toBeOnTheScreen();
  expect(screen.queryByText(tap)).toBeNull();
  expect(target).toHaveProp('accessibilityHint', tap);
});

test('a declaration without a closing stop gets one before the action', async () => {
  await render(<LocalizationProvider initialLocale="pl"><HoldSeal declaration="Ćwiczę codziennie" onSeal={jest.fn()} /></LocalizationProvider>);
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Ćwiczę codziennie. Złóż Przysięgę' })).toBeOnTheScreen();
});

test('with a screen reader the drawn hint asks for the double tap, and follows the setting', async () => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  let changed: ((enabled: boolean) => void) | undefined;
  // The preset's addEventListener is already a jest.fn, so its own implementation is put back by hand.
  const listen = AccessibilityInfo.addEventListener as unknown as jest.Mock;
  const original = listen.getMockImplementation();
  listen.mockImplementation((name: string, handler: (value: boolean) => void) => {
    if (name === 'screenReaderChanged') changed = handler;
    return { remove: jest.fn() };
  });
  try {
    await show();
    expect(screen.getByText('Stuknij dwukrotnie, by złożyć Przysięgę')).toBeOnTheScreen();
    expect(screen.queryByText('Przytrzymaj, by złożyć Przysięgę')).toBeNull();
    await act(async () => changed!(false));
    expect(screen.getByText('Przytrzymaj, by złożyć Przysięgę')).toBeOnTheScreen();
  } finally {
    listen.mockImplementation(original);
  }
});

test('another form passes its own action, hold hint and tap hint', async () => {
  const { target } = await show({ actionLabel: 'Wyślij dowód', hint: 'Przytrzymaj, by wysłać dowód', tapHint: 'Stuknij dwukrotnie, by wysłać dowód' });
  expect(screen.getByRole('button', { name: `${declaration} Wyślij dowód` })).toBe(target);
  expect(screen.getByText('Przytrzymaj, by wysłać dowód')).toBeOnTheScreen();
  expect(target).toHaveProp('accessibilityHint', 'Stuknij dwukrotnie, by wysłać dowód');
});

test('with Reduce Motion the ring never animates and fills in one change at 1.0 s', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  const timing = jest.spyOn(Animated, 'timing');
  const { onSeal, target } = await show();
  await press(target);
  await advance(HOLD_MS - 1);
  expect(screen.getByTestId('hold-seal-holding', { includeHiddenElements: true })).toBeTruthy();
  await advance(1);
  expect(screen.getByTestId('hold-seal-full', { includeHiddenElements: true })).toBeTruthy();
  await release(target);
  expect(onSeal).toHaveBeenCalledTimes(1);
  expect(timing).not.toHaveBeenCalled();
});

test('with motion the ring fills over the hold', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  const timing = jest.spyOn(Animated, 'timing');
  const { onSeal, target } = await show();
  await press(target);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: HOLD_MS }));
  await advance(HOLD_MS);
  await release(target);
  expect(onSeal).toHaveBeenCalledTimes(1);
});

test('the target is at least 44 pt and draws a code ring around a code wax seal until art is hooked', async () => {
  await show();
  expect(currentArt.oaths.holdSeal).toBeNull();
  expect(screen.getByTestId('hold-seal')).toHaveStyle({ minHeight: 44, minWidth: 44 });
  expect(screen.getByTestId('hold-seal-wax', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getAllByTestId('hold-seal-tick', { includeHiddenElements: true }).length).toBeGreaterThanOrEqual(12);
});

test('a hooked sheet draws its idle, pressed and full cells', async () => {
  const art = { ...currentArt, oaths: { ...currentArt.oaths, holdSeal: { ...currentArt.oaths.stepBadges } } };
  await render(<LocalizationProvider initialLocale="pl"><ArtSetProvider art={art}><HoldSeal declaration={declaration} onSeal={jest.fn()} /></ArtSetProvider></LocalizationProvider>);
  await act(async () => {});
  const target = screen.getByTestId('hold-seal');
  await fireEvent(target, 'layout', layout);
  expect(screen.queryByTestId('hold-seal-wax', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByTestId('hold-seal-art-0', { includeHiddenElements: true })).toBeTruthy();
  await press(target);
  expect(screen.getByTestId('hold-seal-art-1', { includeHiddenElements: true })).toBeTruthy();
  await advance(HOLD_MS);
  expect(screen.getByTestId('hold-seal-art-2', { includeHiddenElements: true })).toBeTruthy();
});
