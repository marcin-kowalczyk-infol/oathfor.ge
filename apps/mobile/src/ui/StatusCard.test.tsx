import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { Status, StatusCard } from './StatusCard';

const headings: [Status, string, string][] = [
  ['proof_pending', 'Ocena trwa', 'Assessment pending'],
  ['needs_more_evidence', 'Potrzebne uzupełnienie', 'More evidence needed'],
  ['review_pending', 'W trakcie rozpatrywania', 'Under review'],
  ['fulfilled', 'Spełniona', 'Fulfilled'],
  ['missed', 'Niewykonana', 'Missed'],
  ['recovered', 'Nadrobiona', 'Recovered'],
  ['unresolved', 'Nierozstrzygnięta', 'Unresolved'],
  ['withdrawn', 'Wycofana', 'Withdrawn'],
];

test.each(headings)('%s has distinct PL/EN headings without an invented action', async (status, pl, en) => {
  for (const [locale, heading] of [['pl', pl], ['en', en]] as const) {
    const view = await render(<LocalizationProvider initialLocale={locale}><StatusCard status={status} /></LocalizationProvider>);
    expect(screen.getByRole('header', { name: heading })).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    await view.unmount();
  }
});

test('review context and supplied action remain separate readable elements', async () => {
  const onPress = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><StatusCard status="review_pending" detail="Review deadline: 26 September, 20:00, Europe/Warsaw." action={{ label: 'View Oath', onPress }} /></LocalizationProvider>);
  expect(screen.getByText('Review deadline: 26 September, 20:00, Europe/Warsaw.')).toBeOnTheScreen();
  expect(screen.queryByText('Missed')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'View Oath' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a miss or recovered presentation preserves the supplied earlier-XP context', async () => {
  const view = await render(<LocalizationProvider initialLocale="en"><StatusCard status="missed" detail="Previously earned: 100 XP." /></LocalizationProvider>);
  expect(screen.getByText('Previously earned: 100 XP.')).toBeOnTheScreen();
  await view.rerender(<LocalizationProvider initialLocale="en"><StatusCard status="recovered" detail="Previously earned: 100 XP." /></LocalizationProvider>);
  expect(screen.getByText('Previously earned: 100 XP.')).toBeOnTheScreen();
  expect(screen.getByText('Recovery completed. The earlier missed Oath remains in history.')).toBeOnTheScreen();
});

test('announces a changed status once, without repeating unchanged pending input', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
  announce.mockClear();
  try {
    const view = await render(<LocalizationProvider initialLocale="en"><StatusCard status="proof_pending" /></LocalizationProvider>);
    await view.rerender(<LocalizationProvider initialLocale="en"><StatusCard status="proof_pending" /></LocalizationProvider>);
    expect(announce).not.toHaveBeenCalled();
    await view.rerender(<LocalizationProvider initialLocale="en"><StatusCard status="review_pending" /></LocalizationProvider>);
    expect(announce).toHaveBeenCalledWith('Under review. The case awaits a decision. This is not a miss.', { queue: true });
    await view.rerender(<LocalizationProvider initialLocale="en"><StatusCard status="review_pending" /></LocalizationProvider>);
    expect(announce).toHaveBeenCalledTimes(1);
  } finally { announce.mockRestore(); }
});
