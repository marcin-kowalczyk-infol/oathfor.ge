import { Dimensions } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import en from '../localization/locales/en/messages.json';
import pl from '../localization/locales/pl/messages.json';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { FIELD_HEIGHT, WallTimePicker, type TimeDraft } from './WallTimePicker';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

// 2026-09-28 11:20 UTC is 13:20 in Warsaw and already 00:20 on 29 September in Auckland.
const now = () => Date.parse('2026-09-28T11:20:00Z');
async function picker(value: Partial<TimeDraft> = {}, onChange = jest.fn(), locale: 'en' | 'pl' = 'en', clock = now) {
  await render(<LocalizationProvider initialLocale={locale}><WallTimePicker field="deadline" value={{ date: '', time: '', zone: 'Europe/Warsaw', ...value }} disabled={false} now={clock} onChange={onChange} /></LocalizationProvider>);
  return onChange;
}
const day = (name: string) => screen.getByRole('button', { name });
const initialWindow = Dimensions.get('window');
const size = (width: number, fontScale: number) => Dimensions.set({ window: { width, height: 874, scale: 3, fontScale }, screen: { width, height: 874, scale: 3, fontScale } });
afterEach(() => Dimensions.set({ window: initialWindow, screen: initialWindow }));

test('today is marked and past days cannot be chosen', async () => {
  const onChange = await picker();
  await fireEvent.press(screen.getByRole('button', { name: 'Deadline, completion date' }));
  expect(day('September 28, 2026, Today')).toBeOnTheScreen();
  expect(day('September 27, 2026')).toBeDisabled();
  expect(day('September 1, 2026')).toBeDisabled();
  expect(day('September 29, 2026')).toBeEnabled();
  await fireEvent.press(day('September 27, 2026'));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeEnabled();
  expect(day('October 1, 2026')).toBeEnabled();
});

test('today follows the chosen zone', async () => {
  await picker({ zone: 'Pacific/Auckland' });
  await fireEvent.press(screen.getByRole('button', { name: 'Deadline, completion date' }));
  expect(day('September 29, 2026, Today')).toBeOnTheScreen();
  expect(day('September 28, 2026')).toBeDisabled();
});

test('hours and minutes that passed today are disabled, other days are open', async () => {
  const onChange = await picker({ date: '2026-09-28' });
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByRole('radio', { name: 'Hour 12' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Hour 13' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'Hour 13' }));
  expect(screen.getByRole('radio', { name: 'Minute 20' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Minute 21' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'Minute 21' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hour 14' }));
  expect(screen.getByRole('radio', { name: 'Minute 00' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Use this time' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ time: '14:21:00' }));
});

test('a past time reached in the sheet for today cannot be confirmed', async () => {
  await picker({ date: '2026-09-28' });
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hour 14' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Minute 05' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hour 13' }));
  expect(screen.getByText('13:05')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeDisabled();
});

// Native check, 2026-09-30 at 22:54: the sheet opened today on a greyed 18:00 with a disabled action.
test.each([
  ['nothing chosen yet', ''], ['a stored time that already passed', '09:00:00'],
])('for today with %s the time sheet opens on the first minute after now', async (_case, time) => {
  const onChange = await picker({ date: '2026-09-28', time }, jest.fn(), 'en', () => Date.parse('2026-09-28T20:54:30Z'));
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByText('22:55')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Hour 22' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'Minute 55' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Use this time' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ time: '22:55:00' }));
});

test('the first minute after now rolls into the next hour', async () => {
  await picker({ date: '2026-09-28' }, jest.fn(), 'en', () => Date.parse('2026-09-28T19:59:10Z'));
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByText('22:00')).toBeOnTheScreen();
});

test('an allowed stored time for today stays as it was', async () => {
  await picker({ date: '2026-09-28', time: '23:30:00' }, jest.fn(), 'en', () => Date.parse('2026-09-28T20:54:30Z'));
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByRole('radio', { name: 'Hour 23' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'Minute 30' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeEnabled();
});

// Review, 2026-09-30: the form rendered at 22:50 and a tap at 22:56 opened on a greyed 22:51, since nothing re-rendered the idle picker.
test('the time sheet reads now when it opens, not when the form rendered', async () => {
  let instant = Date.parse('2026-09-28T20:50:00Z');
  await picker({ date: '2026-09-28' }, jest.fn(), 'en', () => instant);
  instant = Date.parse('2026-09-28T20:56:00Z');
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByText('22:57')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Minute 56' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeEnabled();
});

test('the date sheet reads today when it opens, after midnight started a new month', async () => {
  let instant = Date.parse('2026-09-30T21:50:00Z');
  await picker({}, jest.fn(), 'en', () => instant);
  instant = Date.parse('2026-09-30T22:10:00Z');
  await fireEvent.press(screen.getByRole('button', { name: 'Deadline, completion date' }));
  expect(day('October 1, 2026, Today')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
});

test('with no minute left today the sheet keeps 18:00 and cannot confirm it', async () => {
  await picker({ date: '2026-09-28' }, jest.fn(), 'en', () => Date.parse('2026-09-28T21:59:30Z'));
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByText('18:00')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeDisabled();
});

// MVP-22-B2 (G18): the sheet header is a title row with an × close, and the month sits between ‹ and › icon buttons.
// The buttons keep their names for VoiceOver. The past month reason is only the disabled button's hint.
test.each([
  ['pl', 'Termin, data ukończenia', 'Data ukończenia', 'Zamknij', 'Poprzedni miesiąc', 'Następny miesiąc', 'Wcześniejsze miesiące już minęły.', 'wrzesień 2026'],
  ['en', 'Deadline, completion date', 'Completion date', 'Close', 'Previous month', 'Next month', 'Earlier months have passed.', 'September 2026'],
] as const)('the %s date sheet has an × close and ‹ › month buttons with spoken names', async (locale, field, sheet, close, previous, next, past, month) => {
  size(402, 1);
  await picker({}, jest.fn(), locale);
  await fireEvent.press(screen.getByRole('button', { name: field }));
  const closer = screen.getByRole('button', { name: close });
  expect(closer).toHaveTextContent('×', { exact: true });
  expect(closer).toHaveStyle({ minWidth: 44, minHeight: 44 });
  expect(screen.getByTestId('sheet-header')).toHaveStyle({ flexDirection: 'row' });
  expect(screen.getByTestId('sheet-header')).toContainElement(screen.getByRole('header', { name: sheet }));
  const back = screen.getByRole('button', { name: previous });
  const forward = screen.getByRole('button', { name: next });
  expect(back).toHaveTextContent('‹', { exact: true });
  expect(forward).toHaveTextContent('›', { exact: true });
  for (const control of [back, forward]) expect(control).toHaveStyle({ minWidth: 44, minHeight: 44 });
  expect(screen.getByTestId('month-nav')).toContainElement(screen.getByRole('header', { name: month }));
  expect(back).toBeDisabled();
  expect(back).toHaveProp('accessibilityHint', past);
  expect(screen.queryByText(past)).toBeNull();
  await fireEvent.press(forward);
  expect(screen.getByRole('button', { name: previous })).toBeEnabled();
  expect(screen.getByRole('button', { name: previous })).not.toHaveProp('accessibilityHint', past);
  await fireEvent.press(screen.getByRole('button', { name: previous }));
  expect(screen.getByRole('header', { name: month })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: close }));
  expect(screen.queryByRole('header', { name: month })).toBeNull();
});

test('the time sheet closes with the same × control', async () => {
  await picker({}, jest.fn(), 'pl');
  await fireEvent.press(screen.getByRole('button', { name: 'Godzina ukończenia' }));
  const closer = screen.getByRole('button', { name: 'Zamknij' });
  expect(closer).toHaveTextContent('×', { exact: true });
  await fireEvent.press(closer);
  expect(screen.queryByText('18:00')).toBeNull();
});

// MVP-22-B2 (G19): only 00 to 11 showed, the rest of the minutes scrolled inside the sheet without a cue.
test('a fade marks more minutes below until the sheet reaches its end', async () => {
  await picker({}, jest.fn(), 'pl');
  await fireEvent.press(screen.getByRole('button', { name: 'Godzina ukończenia' }));
  const sheet = screen.getByTestId('time-sheet');
  await fireEvent(sheet, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 520 } } });
  await fireEvent(sheet, 'contentSizeChange', 402, 1400);
  const fade = screen.getByTestId('time-sheet-fade', { includeHiddenElements: true });
  expect(fade).toHaveProp('pointerEvents', 'none');
  expect(fade).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  expect(screen.getAllByTestId('time-sheet-fade-strip', { includeHiddenElements: true }).length).toBeGreaterThan(3);
  await fireEvent.scroll(sheet, { nativeEvent: { contentOffset: { x: 0, y: 880 }, contentSize: { width: 402, height: 1400 }, layoutMeasurement: { width: 402, height: 520 } } });
  expect(screen.queryByTestId('time-sheet-fade', { includeHiddenElements: true })).toBeNull();
  await fireEvent.scroll(sheet, { nativeEvent: { contentOffset: { x: 0, y: 200 }, contentSize: { width: 402, height: 1400 }, layoutMeasurement: { width: 402, height: 520 } } });
  expect(screen.getByTestId('time-sheet-fade', { includeHiddenElements: true })).toBeTruthy();
  // Every minute stays reachable, to the minute.
  expect(screen.getByRole('radio', { name: 'Minuta 59' })).toBeOnTheScreen();
});

test('a time sheet whose minutes all fit shows no fade', async () => {
  await picker({}, jest.fn(), 'pl');
  await fireEvent.press(screen.getByRole('button', { name: 'Godzina ukończenia' }));
  const sheet = screen.getByTestId('time-sheet');
  await fireEvent(sheet, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 1500 } } });
  await fireEvent(sheet, 'contentSizeChange', 402, 1400);
  expect(screen.queryByTestId('time-sheet-fade', { includeHiddenElements: true })).toBeNull();
});

test.each([
  ['en', 'Deadline, completion date', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']],
  ['pl', 'Termin, data ukończenia', ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.']],
] as const)('the %s month grid names the weekdays once, Monday first, without VoiceOver repeating them', async (locale, field, names) => {
  size(402, 1);
  await picker({}, jest.fn(), locale);
  await fireEvent.press(screen.getByRole('button', { name: field }));
  expect(screen.queryByTestId('weekday-header')).toBeNull();
  const header = screen.getByTestId('weekday-header', { includeHiddenElements: true });
  expect(header.children.map(cell => (cell as { props: { children?: unknown } }).props.children)).toEqual(names);
  expect(header).toHaveProp('importantForAccessibility', 'no-hide-descendants');
});

test('at the largest text size the full-width day rows carry no weekday header', async () => {
  size(402, 3.571);
  await picker({}, jest.fn(), 'pl');
  await fireEvent.press(screen.getByRole('button', { name: 'Termin, data ukończenia' }));
  expect(screen.queryByTestId('weekday-header', { includeHiddenElements: true })).toBeNull();
});

test('another day keeps every hour and minute', async () => {
  await picker({ date: '2026-09-29' });
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByRole('radio', { name: 'Hour 00' })).toBeEnabled();
  expect(screen.getByRole('radio', { name: 'Minute 00' })).toBeEnabled();
});

// Native check, 2026-09-30: at the largest text size (fontScale 3.571) on a 402 pt iPhone the deadline value broke as "październik" / "a 2026".
test.each([[402], [375]])('at width %i and the largest text size a long Polish month keeps its word whole', async width => {
  size(width, 3.571);
  await picker({ date: '2026-10-08' }, jest.fn(), 'pl');
  const field = screen.getByRole('button', { name: 'Termin, data ukończenia' });
  expect(field).toHaveStyle({ paddingHorizontal: 8, minHeight: FIELD_HEIGHT });
  expect(screen.getByText('8 października 2026').props.maxFontSizeMultiplier).toBe(2.5);
  // Native check, 2026-09-30: uncapped 14 pt captions grew past the capped 17 pt value, so the captions share the cap.
  // MVP-22-E1.4: the drawn captions are short and the zone id is only spoken.
  for (const caption of ['Termin', 'Strefa ukończenia']) expect(screen.getByText(caption).props.maxFontSizeMultiplier).toBe(2.5);
  expect(screen.queryByText('Europe/Warsaw')).toBeNull();
  await fireEvent.press(field);
  expect(screen.getByRole('button', { name: '31 października 2026' })).toHaveTextContent('31 października 2026');
  expect(screen.getByText('31 października 2026').props.maxFontSizeMultiplier).toBe(2.5);
});

test('at the default text size the field keeps its padding and height', async () => {
  size(402, 1);
  await picker({ date: '2026-10-08' }, jest.fn(), 'pl');
  const field = screen.getByRole('button', { name: 'Termin, data ukończenia' });
  expect(field).toHaveStyle({ padding: 16, minHeight: FIELD_HEIGHT });
  expect(field).not.toHaveStyle({ paddingHorizontal: 8 });
});

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
// Native check, 2026-09-30: at fontScale 3.571 the sheet titles broke as "ukończe" / "nia", the month buttons as "Poprze" / "dni"
// and the past month note as "miesią" / "ce" (the note is a hint since MVP-22-B2). Widths below are measured with the system font, the sheet content is 370 pt wide at 402 and 343 pt at 375.
test.each([[402], [375]])('at width %i and the largest text size the picker sheets keep every word whole', async width => {
  size(width, 3.571);
  await picker({ date: '', time: '' }, jest.fn(), 'pl');
  await fireEvent.press(screen.getByRole('button', { name: 'Godzina ukończenia' }));
  // "ukończenia" needs 445 pt at 85.7 pt bold, 253 pt at the display cap of 48 pt. "23:59" needs 353 pt at 128.6 pt, about 198 pt at 72 pt.
  expect(screen.getByRole('header', { name: 'Godzina ukończenia' }).props.maxFontSizeMultiplier).toBe(2);
  expect(screen.getByText('18:00').props.maxFontSizeMultiplier).toBe(2);
  await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));

  await fireEvent.press(screen.getByRole('button', { name: 'Termin, data ukończenia' }));
  expect(screen.getByRole('header', { name: 'Data ukończenia' }).props.maxFontSizeMultiplier).toBe(2);
  // "październik" needs 450 pt uncapped and "wrzesień" 351 pt, which breaks at 375.
  const heading = screen.getByRole('header', { name: 'wrzesień 2026' });
  expect(heading.props.maxFontSizeMultiplier).toBe(2);
  // The full-width day rows ("31 października 2026" at the choice cap) keep the trimmed 8 pt side padding.
  expect(flat(screen.getByTestId('date-sheet').props.contentContainerStyle)).toMatchObject({ paddingHorizontal: 8 });
  // MVP-22-B2: the month buttons are icons, so the row keeps ‹ month › and the heading wraps between them.
  const nav = screen.getByTestId('month-nav');
  expect(nav).toHaveStyle({ flexDirection: 'row' });
  expect(flat(heading.props.style)).toMatchObject({ flexShrink: 1 });
  expect(screen.getByRole('button', { name: 'Poprzedni miesiąc' })).toBeDisabled();
  expect(screen.queryByText('Wcześniejsze miesiące już minęły.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));

  await fireEvent.press(screen.getByRole('button', { name: 'Strefa ukończenia' }));
  // "koordynowany" needs 397 pt and "DumontDUrville" 430 pt in a 338 pt row, "Bahia_Banderas" 347 pt as a caption.
  const row = screen.getByRole('radio', { name: 'Uniwersalny czas koordynowany · UTC' });
  expect(row).toHaveStyle({ paddingHorizontal: 8 });
  expect(screen.getByText('Uniwersalny czas koordynowany').props.maxFontSizeMultiplier).toBe(2.5);
  expect(screen.getByText('UTC').props.maxFontSizeMultiplier).toBe(2.5);
});

test('at the default text size the sheets keep their layout', async () => {
  size(402, 1);
  await picker({ date: '', time: '' }, jest.fn(), 'pl');
  await fireEvent.press(screen.getByRole('button', { name: 'Termin, data ukończenia' }));
  const heading = screen.getByRole('header', { name: 'wrzesień 2026' });
  expect(heading).toBeOnTheScreen();
  const content = flat(screen.getByTestId('date-sheet').props.contentContainerStyle);
  expect(content).toMatchObject({ padding: 16 });
  expect(content).not.toHaveProperty('paddingHorizontal');
  expect(screen.getByTestId('month-nav')).toHaveStyle({ flexDirection: 'row' });
  await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Strefa ukończenia' }));
  const row = screen.getByRole('radio', { name: 'Uniwersalny czas koordynowany · UTC' });
  expect(row).toHaveStyle({ padding: 16 });
  expect(row).not.toHaveStyle({ paddingHorizontal: 8 });
});

// Review after MVP-22-B2: scrolling the minutes must not re-render the sheet on every tick, only when the fade flips.
test('scrolling the minutes re-renders the sheet only when the fade appears or goes', async () => {
  const renders = jest.fn();
  const { Profiler } = jest.requireActual<typeof import('react')>('react');
  await render(<Profiler id="picker" onRender={renders}><LocalizationProvider initialLocale="pl"><WallTimePicker field="deadline" value={{ date: '', time: '', zone: 'Europe/Warsaw' }} disabled={false} now={now} onChange={jest.fn()} /></LocalizationProvider></Profiler>);
  await fireEvent.press(screen.getByRole('button', { name: 'Godzina ukończenia' }));
  const sheet = screen.getByTestId('time-sheet');
  await fireEvent(sheet, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 520 } } });
  await fireEvent(sheet, 'contentSizeChange', 402, 1400);
  renders.mockClear();
  for (const y of [40, 80, 120, 160, 200]) await fireEvent.scroll(sheet, { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 402, height: 1400 }, layoutMeasurement: { width: 402, height: 520 } } });
  expect(renders).not.toHaveBeenCalled();
  await fireEvent.scroll(sheet, { nativeEvent: { contentOffset: { x: 0, y: 880 }, contentSize: { width: 402, height: 1400 }, layoutMeasurement: { width: 402, height: 520 } } });
  expect(renders).toHaveBeenCalled();
  expect(screen.queryByTestId('time-sheet-fade', { includeHiddenElements: true })).toBeNull();
});

// MVP-22-B2c, review finding: secondary text at opacity 0.35 on the canvas gave 2.13:1. At 0.6 it gives 3.86:1, above the 3:1
// WCAG 2.2 non-text minimum for a visible disabled cue (https://www.w3.org/TR/WCAG22/#non-text-contrast).
test('past days, past hours and the past month glyph stay readable at 3:1', async () => {
  await picker({ date: '2026-09-28' });
  await fireEvent.press(screen.getByRole('button', { name: 'Deadline, completion date' }));
  expect(day('September 27, 2026')).toHaveStyle({ opacity: 0.6 });
  expect(screen.getByText('‹')).toHaveStyle({ opacity: 0.6 });
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Time, deadline' }));
  expect(screen.getByRole('radio', { name: 'Hour 12' })).toHaveStyle({ opacity: 0.6 });
});

// MVP-22-E1.R, review finding (WCAG 2.5.3 Label in Name, https://www.w3.org/TR/WCAG22/#label-in-name): the spoken name holds the
// drawn caption, so a voice command with the visible word reaches the field. The date and time captions open their names, the
// zone caption is its whole name. MVP-22-E1.5, native check 2026-10-02: the time field now draws its own caption like the date.
test.each([['pl', 'activation'], ['pl', 'deadline'], ['en', 'activation'], ['en', 'deadline']] as const)('the %s %s fields speak their drawn captions', async (locale, field) => {
  const oath = (locale === 'pl' ? pl : en).oath;
  await render(<LocalizationProvider initialLocale={locale}><WallTimePicker field={field} value={{ date: '', time: '18:30:00', zone: 'Europe/Warsaw' }} disabled={false} now={now} onChange={jest.fn()} /></LocalizationProvider>);
  const [date, time, zone] = screen.getAllByRole('button');
  for (const [button, caption] of [[date, oath[`${field}Caption`]], [time, oath.timeCaption]] as const) {
    expect(within(button).getByText(caption)).toBeOnTheScreen();
    expect(button.props.accessibilityLabel.startsWith(caption)).toBe(true);
  }
  expect(within(time).getAllByText(/./).map(text => text.props.children)).toEqual([oath.timeCaption, '18:30', '›']);
  expect(within(zone).getByText(oath[`${field}Zone`])).toBeOnTheScreen();
  expect(zone.props.accessibilityLabel).toBe(oath[`${field}Zone`]);
});

test('a picker draws only the parts it is given', async () => {
  await render(<LocalizationProvider initialLocale="en"><WallTimePicker field="deadline" parts={['zone']} value={{ date: '', time: '', zone: 'Europe/Warsaw' }} disabled={false} now={now} onChange={jest.fn()} /></LocalizationProvider>);
  expect(screen.getAllByRole('button').map(button => button.props.accessibilityLabel)).toEqual(['Completion timezone']);
});

// MVP-22-E1.R, native check: an ellipsis read as loading. Every field ends in a chevron, so it reads as a control.
// MVP-22-E1.5, native check 2026-10-02: the date drew "Termin" above its calendar while the time drew only a clock, so the two
// rows had different heights and read as unrelated. Both now draw one row, pictogram, caption, chevron. An empty field shows its
// caption where the value goes, a chosen value stands under the small caption. The spoken value still asks for a choice.
test.each(['en', 'pl'] as const)('%s empty fields draw a pictogram, their caption in the value place and a chevron', async locale => {
  const oath = (locale === 'pl' ? pl : en).oath;
  await picker({}, jest.fn(), locale);
  expect(screen.queryByText('…')).toBeNull();
  const [date, time, zone] = screen.getAllByRole('button');
  expect(within(date).getByTestId('field-calendar')).toBeOnTheScreen();
  expect(within(time).getByTestId('field-clock')).toBeOnTheScreen();
  expect(within(date).getAllByText(/./).map(text => text.props.children)).toEqual([oath.deadlineCaption, '›']);
  expect(within(time).getAllByText(/./).map(text => text.props.children)).toEqual([oath.timeCaption, '›']);
  for (const button of [date, time, zone]) expect(within(button).getByText('›')).toHaveProp('accessible', false);
  expect(date.props.accessibilityValue).toEqual({ text: locale === 'pl' ? 'Wybierz datę' : 'Choose a date' });
  expect(time.props.accessibilityValue).toEqual({ text: locale === 'pl' ? 'Wybierz godzinę' : 'Choose a time' });
});

test('a chosen value stands under its small caption, beside its pictogram', async () => {
  await picker({ date: '2026-10-08', time: '18:30:00' });
  const [date, time] = screen.getAllByRole('button');
  expect(within(date).getAllByText(/./).map(text => text.props.children)).toEqual(['Deadline', 'October 8, 2026', '›']);
  expect(within(date).getByTestId('field-calendar')).toBeOnTheScreen();
  expect(within(time).getAllByText(/./).map(text => text.props.children)).toEqual(['Time', '18:30', '›']);
  expect(within(time).getByTestId('field-clock')).toBeOnTheScreen();
});

// The pictogram labels are the `icon` exemption of the word budget (engagement.md D-E4): one word beside a calendar or a clock.
test.each([['empty', {}], ['chosen', { date: '2026-10-08', time: '18:30:00' }]] as const)('%s date and time fields share one structure, style and height', async (_case, value) => {
  await picker(value);
  const [date, time] = screen.getAllByRole('button');
  expect(flat(date.props.style)).toEqual(flat(time.props.style));
  // 16 pt padding, the 21 pt caption line and the 22 pt value line, 16 pt padding. An empty row keeps the height of a chosen one.
  expect(FIELD_HEIGHT).toBe(16 + 21 + 22 + 16);
  expect(flat(date.props.style).minHeight).toBe(FIELD_HEIGHT);
  const texts = (button: typeof date) => within(button).getAllByText(/./).map(text => [flat(text.props.style), text.props.budget ?? null]);
  expect(texts(date)).toEqual(texts(time));
  const caption = within(date).getByText('Deadline');
  expect(caption.props.budget).toBe('icon');
  expect(within(time).getByText('Time').props.budget).toBe('icon');
});
