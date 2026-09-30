import { render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { SpriteFrame, SpriteLoop } from './Sprite';
import { currentArt } from '../art/current';

const { effects: effectSheets, zharomir: heroSheets } = currentArt;

const image = (testID: string) => StyleSheet.flatten((screen.getByTestId(testID, { includeHiddenElements: true }).children[0] as unknown as { props: { style: object } }).props.style) as
  { left: number; top: number; width: number; height: number };

test('a frame shows its cell of a 4 by 2 sheet at the requested height', async () => {
  await render(<SpriteFrame sheet={heroSheets.walk.back} index={5} height={100} testID="cell" />);
  const cell = StyleSheet.flatten(screen.getByTestId('cell', { includeHiddenElements: true }).props.style) as { width: number; height: number };
  expect(cell).toMatchObject({ width: 90, height: 100 });
  expect(image('cell')).toMatchObject({ left: -90, top: -100, width: 360, height: 200 });
});

test('a 2 by 2 sheet wraps its fourth frame to the second row', async () => {
  await render(<SpriteFrame sheet={heroSheets.act.hearth} index={3} height={100} testID="cell" />);
  expect(image('cell')).toMatchObject({ left: -90, top: -100, width: 180, height: 200 });
});

test('a loop runs only while motion is allowed and stops on unmount', async () => {
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
  const view = await render(<SpriteLoop sheet={effectSheets.hearthLoop} width={60} duration={1200} allowed={false} />);
  expect(loop).not.toHaveBeenCalled();
  await view.rerender(<SpriteLoop sheet={effectSheets.hearthLoop} width={60} duration={1200} allowed />);
  expect(loop).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(stop).toHaveBeenCalled();
  jest.restoreAllMocks();
});

test('light sheets use a screen blend and solid sheets do not', async () => {
  await render(<>
    <SpriteLoop sheet={effectSheets.hearthLoop} width={60} duration={1200} allowed={false} testID="light" />
    <SpriteLoop sheet={currentArt.room.bookPageTurn!.sheet} width={60} duration={1200} allowed={false} testID="page" />
  </>);
  expect(StyleSheet.flatten(screen.getByTestId('light', { includeHiddenElements: true }).props.style)).toMatchObject({ mixBlendMode: 'screen' });
  expect(StyleSheet.flatten(screen.getByTestId('page', { includeHiddenElements: true }).props.style).mixBlendMode).toBeUndefined();
});
