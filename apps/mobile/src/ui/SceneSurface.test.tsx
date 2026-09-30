import { act, render, screen } from '@testing-library/react-native';
import { Animated, Dimensions, StyleSheet, Text } from 'react-native';
import { ArtProvider, resolveArt } from '../art/ArtProvider';
import { SceneSurface } from './SceneSurface';
import { useMotionAllowed } from './useMotion';

jest.mock('./useMotion', () => ({ useMotionAllowed: jest.fn() }));
// The flame owns its loop. Its props show where the surface places it.
jest.mock('./HearthFire', () => ({ HearthFire: (props: object) => { const { View } = require('react-native'); return <View testID="hearth-flame" {...props} />; } }));
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

test('the close-up follows the content when the list is pulled down, so text never slides onto the art', async () => {
  motion.mockReturnValue(false);
  const scroll = new Animated.Value(0);
  await render(<SceneSurface place="chronicle" drop={0.3} scroll={scroll}><Text>History</Text></SceneSurface>);
  await act(async () => { scroll.setValue(-80); });
  const style = StyleSheet.flatten(screen.getByTestId('forge-scroller', { includeHiddenElements: true }).props.style);
  expect(style.transform).toEqual([{ translateY: 80 }]);
});

test.each(['current', 'cinematic'] as const)('the hearth close-up shows its own art and places the flame on its fire bed for the %s art', async style => {
  motion.mockReturnValue(false);
  const art = resolveArt(style);
  const hidden = { includeHiddenElements: true };
  await render(<ArtProvider style={style}><SceneSurface place="hearth"><Text>Hearth</Text></SceneSurface></ArtProvider>);
  expect(screen.getByTestId('forge-closeup-image', hidden).props.source).toBe(art.stations.hearth);
  const flame = screen.getByTestId('hearth-flame', hidden).props;
  // The close-up spans the window width and is 1.5 times as tall, from the top.
  const { width } = Dimensions.get('window');
  expect(flame.anchor.left / width).toBeCloseTo(art.stationFire.x, 5);
  expect(flame.anchor.top / (width * 1.5)).toBeCloseTo(art.stationFire.y, 5);
  expect(flame.size / width).toBeCloseTo(art.stationFire.width, 5);
});
