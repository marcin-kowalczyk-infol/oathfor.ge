import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SceneSurface } from './SceneSurface';
import { useMotionAllowed } from './useMotion';

jest.mock('./useMotion', () => ({ useMotionAllowed: jest.fn() }));
const motion = jest.mocked(useMotionAllowed);

test('arriving from the room zooms into the place only when motion is allowed', async () => {
  motion.mockReturnValue(true);
  const view = await render(<SceneSurface place="chronicle" approach={1}><Text>History</Text></SceneSurface>);
  expect(screen.getByTestId('forge-approach-chronicle', { includeHiddenElements: true })).toBeTruthy();
  motion.mockReturnValue(false);
  await view.rerender(<SceneSurface place="chronicle" approach={2}><Text>History</Text></SceneSurface>);
  expect(screen.queryByTestId('forge-approach-chronicle', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByTestId('forge-place-chronicle', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('History')).toBeOnTheScreen();
});

test('leaving a place mid-approach removes the room overlay', async () => {
  motion.mockReturnValue(true);
  const view = await render(<SceneSurface place="seals" approach={1}><Text>Today</Text></SceneSurface>);
  expect(screen.getByTestId('forge-approach-seals', { includeHiddenElements: true })).toBeTruthy();
  await view.rerender(<SceneSurface place="chronicle" approach={null}><Text>History</Text></SceneSurface>);
  expect(screen.queryByTestId('forge-approach-seals', { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByTestId('forge-approach-chronicle', { includeHiddenElements: true })).toBeNull();
});
