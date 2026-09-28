import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { WallTimePicker, type TimeDraft } from './WallTimePicker';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

// 2026-09-28 11:20 UTC is 13:20 in Warsaw and already 00:20 on 29 September in Auckland.
const now = () => Date.parse('2026-09-28T11:20:00Z');
async function picker(value: Partial<TimeDraft> = {}, onChange = jest.fn()) {
  await render(<LocalizationProvider initialLocale="en"><WallTimePicker field="deadline" value={{ date: '', time: '', zone: 'Europe/Warsaw', ...value }} disabled={false} now={now} onChange={onChange} /></LocalizationProvider>);
  return onChange;
}
const day = (name: string) => screen.getByRole('button', { name });

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

test('a past time already chosen for today cannot be confirmed', async () => {
  await picker({ date: '2026-09-28', time: '09:00:00' });
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByRole('button', { name: 'Use this time' })).toBeDisabled();
});

test('another day keeps every hour and minute', async () => {
  await picker({ date: '2026-09-29' });
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  expect(screen.getByRole('radio', { name: 'Hour 00' })).toBeEnabled();
  expect(screen.getByRole('radio', { name: 'Minute 00' })).toBeEnabled();
});
