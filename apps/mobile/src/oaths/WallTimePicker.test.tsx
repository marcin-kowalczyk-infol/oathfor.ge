import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { WallTimePicker, type TimeDraft } from './WallTimePicker';
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
  await fireEvent.press(screen.getByRole('button', { name: 'Completion date' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Completion date' }));
  expect(day('September 29, 2026, Today')).toBeOnTheScreen();
  expect(day('September 28, 2026')).toBeDisabled();
});

test('hours and minutes that passed today are disabled, other days are open', async () => {
  const onChange = await picker({ date: '2026-09-28' });
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByText('22:55')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Hour 22' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'Minute 55' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Use this time' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ time: '22:55:00' }));
});

test('the first minute after now rolls into the next hour', async () => {
  await picker({ date: '2026-09-28' }, jest.fn(), 'en', () => Date.parse('2026-09-28T19:59:10Z'));
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByText('22:00')).toBeOnTheScreen();
});

test('an allowed stored time for today stays as it was', async () => {
  await picker({ date: '2026-09-28', time: '23:30:00' }, jest.fn(), 'en', () => Date.parse('2026-09-28T20:54:30Z'));
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByRole('radio', { name: 'Hour 23' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'Minute 30' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeEnabled();
});

// Review, 2026-09-30: the form rendered at 22:50 and a tap at 22:56 opened on a greyed 22:51, since nothing re-rendered the idle picker.
test('the time sheet reads now when it opens, not when the form rendered', async () => {
  let instant = Date.parse('2026-09-28T20:50:00Z');
  await picker({ date: '2026-09-28' }, jest.fn(), 'en', () => instant);
  instant = Date.parse('2026-09-28T20:56:00Z');
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByText('22:57')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Minute 56' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeEnabled();
});

test('the date sheet reads today when it opens, after midnight started a new month', async () => {
  let instant = Date.parse('2026-09-30T21:50:00Z');
  await picker({}, jest.fn(), 'en', () => instant);
  instant = Date.parse('2026-09-30T22:10:00Z');
  await fireEvent.press(screen.getByRole('button', { name: 'Completion date' }));
  expect(day('October 1, 2026, Today')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
});

test('with no minute left today the sheet keeps 18:00 and cannot confirm it', async () => {
  await picker({ date: '2026-09-28' }, jest.fn(), 'en', () => Date.parse('2026-09-28T21:59:30Z'));
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByText('18:00')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeDisabled();
});

// Native check, 2026-09-30: both month buttons pointed right, and the Monday-first grid had no weekday names.
test('the previous month points back and the next month points forward', async () => {
  await picker();
  await fireEvent.press(screen.getByRole('button', { name: 'Completion date' }));
  expect(screen.getByRole('button', { name: 'Previous month' })).toHaveTextContent(/^‹\s*Previous month$/);
  expect(screen.getByRole('button', { name: 'Next month' })).toHaveTextContent(/^Next month\s*›$/);
  await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
  expect(screen.getByRole('button', { name: 'Previous month' })).toHaveTextContent(/^‹\s*Previous month$/);
});

test.each([
  ['en', 'Completion date', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']],
  ['pl', 'Data ukończenia', ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.']],
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
  await fireEvent.press(screen.getByRole('button', { name: 'Data ukończenia' }));
  expect(screen.queryByTestId('weekday-header', { includeHiddenElements: true })).toBeNull();
});

test('another day keeps every hour and minute', async () => {
  await picker({ date: '2026-09-29' });
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByRole('radio', { name: 'Hour 00' })).toBeEnabled();
  expect(screen.getByRole('radio', { name: 'Minute 00' })).toBeEnabled();
});

// Native check, 2026-09-30: at the largest text size (fontScale 3.571) on a 402 pt iPhone the deadline value broke as "październik" / "a 2026".
test.each([[402], [375]])('at width %i and the largest text size a long Polish month keeps its word whole', async width => {
  size(width, 3.571);
  await picker({ date: '2026-10-08' }, jest.fn(), 'pl');
  const field = screen.getByRole('button', { name: 'Data ukończenia' });
  expect(field).toHaveStyle({ paddingHorizontal: 8, minHeight: 64 });
  expect(screen.getByText('8 października 2026').props.maxFontSizeMultiplier).toBe(2.5);
  // Native check, 2026-09-30: uncapped 14 pt captions grew past the capped 17 pt value, so the label and zone identifier share the cap.
  for (const caption of ['Data ukończenia', 'Godzina ukończenia', 'Strefa ukończenia', 'Europe/Warsaw']) expect(screen.getByText(caption).props.maxFontSizeMultiplier).toBe(2.5);
  await fireEvent.press(field);
  expect(screen.getByRole('button', { name: '31 października 2026' })).toHaveTextContent('31 października 2026');
  expect(screen.getByText('31 października 2026').props.maxFontSizeMultiplier).toBe(2.5);
});

test('at the default text size the field keeps its padding and height', async () => {
  size(402, 1);
  await picker({ date: '2026-10-08' }, jest.fn(), 'pl');
  const field = screen.getByRole('button', { name: 'Data ukończenia' });
  expect(field).toHaveStyle({ padding: 16, minHeight: 64 });
  expect(field).not.toHaveStyle({ paddingHorizontal: 8 });
});

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
// Native check, 2026-09-30: at fontScale 3.571 the sheet titles broke as "ukończe" / "nia", the month buttons as "Poprze" / "dni"
// and the past month note as "miesią" / "ce". Widths below are measured with the system font, the sheet content is 370 pt wide at 402 and 343 pt at 375.
test.each([[402], [375]])('at width %i and the largest text size the picker sheets keep every word whole', async width => {
  size(width, 3.571);
  await picker({ date: '', time: '' }, jest.fn(), 'pl');
  await fireEvent.press(screen.getByRole('button', { name: 'Godzina ukończenia' }));
  // "ukończenia" needs 445 pt at 85.7 pt bold, 253 pt at the display cap of 48 pt. "23:59" needs 353 pt at 128.6 pt, about 198 pt at 72 pt.
  expect(screen.getByRole('header', { name: 'Godzina ukończenia' }).props.maxFontSizeMultiplier).toBe(2);
  expect(screen.getByText('18:00').props.maxFontSizeMultiplier).toBe(2);
  await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));

  await fireEvent.press(screen.getByRole('button', { name: 'Data ukończenia' }));
  expect(screen.getByRole('header', { name: 'Data ukończenia' }).props.maxFontSizeMultiplier).toBe(2);
  // "październik" needs 450 pt uncapped and "wrzesień" 351 pt, which breaks at 375.
  const heading = screen.getByRole('header', { name: 'wrzesień 2026' });
  expect(heading.props.maxFontSizeMultiplier).toBe(2);
  // "Wcześniejsze" needs 347 pt at 60.7 pt, so the date sheet trims its side padding to 8 pt for 359 pt at 375.
  expect(flat(screen.getByTestId('date-sheet').props.contentContainerStyle)).toMatchObject({ paddingHorizontal: 8 });
  // "Poprzedni" needs 192 pt, a half-width label has about 148 pt, so the buttons stack at full width.
  const nav = screen.getByTestId('month-nav');
  expect(nav).toHaveStyle({ flexDirection: 'column' });
  expect(nav.children).toHaveLength(2);
  for (const slot of nav.children) expect(flat((slot as { props: { style?: unknown } }).props.style)).not.toMatchObject({ flex: 1 });
  expect(screen.getByRole('button', { name: 'Poprzedni miesiąc' })).toBeDisabled();
  expect(screen.getByText('Wcześniejsze miesiące już minęły.')).toBeOnTheScreen();
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
  await fireEvent.press(screen.getByRole('button', { name: 'Data ukończenia' }));
  const heading = screen.getByRole('header', { name: 'wrzesień 2026' });
  expect(heading).toBeOnTheScreen();
  const content = flat(screen.getByTestId('date-sheet').props.contentContainerStyle);
  expect(content).toMatchObject({ padding: 16 });
  expect(content).not.toHaveProperty('paddingHorizontal');
  const nav = screen.getByTestId('month-nav');
  expect(nav).toHaveStyle({ flexDirection: 'row' });
  expect(nav.children).toHaveLength(2);
  for (const slot of nav.children) expect(flat((slot as { props: { style?: unknown } }).props.style)).toMatchObject({ flex: 1 });
  await fireEvent.press(screen.getByRole('button', { name: 'Zamknij' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Strefa ukończenia' }));
  const row = screen.getByRole('radio', { name: 'Uniwersalny czas koordynowany · UTC' });
  expect(row).toHaveStyle({ padding: 16 });
  expect(row).not.toHaveStyle({ paddingHorizontal: 8 });
});
