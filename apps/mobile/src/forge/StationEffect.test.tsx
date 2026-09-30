import { act, render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { ArtProvider, ArtSetProvider, resolveArt } from '../art/ArtProvider';
import { StationEffect, sealTurns, responseDuration, responseWindows } from './StationEffect';

const point = (x: number, y: number) => ({ left: x * 400, top: y * 800 });
const effect = (station: 'hearth' | 'seals' | 'chronicle' | 'door', request: number, allowed: boolean) =>
  <StationEffect station={station} request={request} allowed={allowed} point={point} sceneWidth={400} />;

test('a touch response stops on backgrounding and does not replay on return', async () => {
  const stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
  const view = await render(effect('chronicle', 1, true));
  expect(timing).toHaveBeenCalledTimes(1);
  await view.rerender(effect('chronicle', 1, false));
  expect(stop).toHaveBeenCalledTimes(1);
  await view.rerender(effect('chronicle', 1, true));
  expect(timing).toHaveBeenCalledTimes(1);
  await view.rerender(effect('chronicle', 2, true));
  expect(timing).toHaveBeenCalledTimes(2);
  await view.unmount();
  expect(stop).toHaveBeenCalledTimes(2);
  jest.restoreAllMocks();
});

test('a reduced-motion touch stays static even if animation is enabled later', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(effect('hearth', 1, false));
  await view.rerender(effect('hearth', 1, true));
  expect(timing).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

const hidden = { includeHiddenElements: true };
const played = () => {
  const finishes: ((result: { finished: boolean }) => void)[] = [];
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: done => { if (done) finishes.push(done); }, stop: jest.fn(), reset: jest.fn() }));
  return { timing, finishes };
};
afterEach(() => jest.restoreAllMocks());

test('the seal drums turn one after another, each with its own motif and sparks, from one timing', async () => {
  const { timing, finishes } = played();
  await render(effect('seals', 1, true));
  expect(timing).toHaveBeenCalledTimes(1);
  expect(sealTurns.map(turn => [turn.id, turn.start, turn.end])).toEqual([['star', 0, 450], ['tree', 200, 650], ['wolf', 400, 850]]);
  for (const seal of ['star', 'tree', 'wolf']) {
    expect(screen.getByTestId(`cut-seal-${seal}`, hidden)).toBeTruthy();
    expect(screen.getByTestId(`fx-seal-${seal}`, hidden)).toBeTruthy();
    expect(screen.getAllByTestId(new RegExp(`^spark-${seal}-`), hidden)).toHaveLength(2);
  }
  // Each drum turns once in plane around its own centre.
  const star = StyleSheet.flatten(screen.getByTestId('cut-seal-star', hidden).props.style) as { transform: { rotate: string }[] };
  expect(star.transform[0].rotate).toBe('0deg');
  await act(async () => finishes[0]({ finished: true }));
  expect(screen.queryByTestId('cut-seal-star', hidden)).toBeNull();
  expect(screen.queryByTestId('spark-star-0', hidden)).toBeNull();
});

// Owner review 2026-09-28: the flutter looked like pages falling out. One leaf now turns over the book.
test('the chronicle turns one page over the book, then signs rise from it', async () => {
  played();
  await render(effect('chronicle', 1, true));
  expect(screen.getByTestId('fx-book-page-turn', hidden)).toBeTruthy();
  expect(screen.queryByTestId('fx-book-flutter', hidden)).toBeNull();
  expect(screen.getByTestId('fx-book-signs', hidden)).toBeTruthy();
});

test('the leaf turns in 400 to 500 ms and the signs rise after it lands', () => {
  const windows = responseWindows('chronicle');
  const frame = (windows['fx-book-page-turn'][1] - windows['fx-book-page-turn'][0]) / 8;
  // Frames 2 to 5 carry the leaf over the spine.
  expect(frame * 4).toBeGreaterThanOrEqual(400);
  expect(frame * 4).toBeLessThanOrEqual(500);
  expect(windows['fx-book-signs'][0]).toBeGreaterThanOrEqual(windows['fx-book-page-turn'][0] + frame * 5);
});

test('the door leaf swings from its hinge with the mist and returns to rest', async () => {
  const { timing, finishes } = played();
  await render(effect('door', 1, true));
  expect(timing).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('fx-door', hidden)).toBeTruthy();
  const leaf = StyleSheet.flatten(screen.getByTestId('cut-door-leaf', hidden).props.style) as { transform: { scaleX: number }[]; transformOrigin: unknown[] };
  expect(leaf.transform[0].scaleX).toBe(1);
  // The hinge is on the left of the leaf.
  expect(leaf.transformOrigin[0]).toBeCloseTo((34 - 31) * 400 / 887);
  expect(screen.getByTestId('door-backing', hidden)).toBeTruthy();
  await act(async () => finishes[0]({ finished: true }));
  expect(screen.queryByTestId('cut-door-leaf', hidden)).toBeNull();
  expect(screen.queryByTestId('door-backing', hidden)).toBeNull();
});

test('the hearth flares and its coals brighten and settle', async () => {
  played();
  await render(effect('hearth', 1, true));
  expect(screen.getByTestId('fx-hearth', hidden)).toBeTruthy();
  expect(screen.getByTestId('fx-coals', hidden)).toBeTruthy();
});

test('every response fits well inside the navigation limit', () => {
  for (const station of ['hearth', 'seals', 'chronicle', 'door'] as const) expect(responseDuration(station)).toBeLessThanOrEqual(1200);
});

test.each(['seals', 'door'] as const)('with reduced motion the %s cut layers stay at rest and nothing turns', async station => {
  const { timing } = played();
  await render(effect(station, 1, false));
  expect(timing).not.toHaveBeenCalled();
  expect(screen.queryByTestId(/^cut-/, hidden)).toBeNull();
});

// Review finding: the last light frame ended half a frame after the effect and stayed at half opacity.
test.each(['hearth', 'seals', 'chronicle', 'door'] as const)('a finished or reduced-motion %s response leaves nothing drawn', async station => {
  await render(effect(station, 1, false));
  const layers = screen.getAllByTestId(/^fx-/, { includeHiddenElements: true });
  for (const layer of layers) for (const frame of layer.children as unknown as { props: { style: object } }[]) {
    expect(StyleSheet.flatten(frame.props.style)).toMatchObject({ opacity: 0 });
  }
});

// Owner decision 2026-09-29: C4 has no cuts yet, and the v03 cuts differ from it in material. Its responses play only lights.
test('the cinematic chronicle turns its own leaf where the cinematic book lies', async () => {
  played();
  await render(<ArtProvider style="cinematic">{effect('chronicle', 1, true)}</ArtProvider>);
  const leaf = screen.getByTestId('fx-book-page-turn', hidden);
  const style = StyleSheet.flatten(leaf.props.style) as { left: number; top: number; width: number; height: number };
  // point() maps the 887 pixel artwork onto 400 points.
  expect(style.left / 400 * 887).toBeCloseTo(644, 0);
  expect(style.top / 800 * 1774).toBeCloseTo(819, 0);
  expect(style.width / 400 * 887).toBeCloseTo(179, 0);
});

test('the cinematic room turns its own drums and door leaf', async () => {
  played();
  const room = resolveArt('cinematic').room;
  const view = await render(<ArtProvider style="cinematic">{effect('seals', 1, true)}</ArtProvider>);
  for (const seal of ['star', 'tree', 'wolf'] as const) expect(screen.getByTestId(`cut-seal-${seal}`, hidden).props.source).toBe(room.seals![seal].source);
  await view.rerender(<ArtProvider style="cinematic">{effect('door', 2, true)}</ArtProvider>);
  expect(screen.getByTestId('cut-door-leaf', hidden).props.source).toBe(room.doorLeaf!.source);
});

// Owner decision 2026-09-29: a room never shows cuts of another room. Without its own cuts it plays only lights.
test('a room without its own cuts plays the lights without any cut layer', async () => {
  played();
  const cinematic = resolveArt('cinematic');
  const bare = { ...cinematic, room: { ...cinematic.room, sealsFront: null, doorLeaf: null, seals: null, bookPageTurn: null } };
  const withoutCuts = (station: 'seals' | 'chronicle' | 'door') => <ArtSetProvider art={bare}>{effect(station, 1, true)}</ArtSetProvider>;
  const view = await render(withoutCuts('seals'));
  for (const seal of ['star', 'tree', 'wolf']) {
    expect(screen.queryByTestId(`cut-seal-${seal}`, hidden)).toBeNull();
    expect(screen.getByTestId(`fx-seal-${seal}`, hidden)).toBeTruthy();
    expect(screen.getAllByTestId(new RegExp(`^spark-${seal}-`), hidden)).toHaveLength(2);
  }
  await view.rerender(withoutCuts('door'));
  expect(screen.queryByTestId('cut-door-leaf', hidden)).toBeNull();
  expect(screen.queryByTestId('door-backing', hidden)).toBeNull();
  expect(screen.getByTestId('fx-door', hidden)).toBeTruthy();
  await view.rerender(withoutCuts('chronicle'));
  expect(screen.queryByTestId('fx-book-page-turn', hidden)).toBeNull();
  expect(screen.getByTestId('fx-book-signs', hidden)).toBeTruthy();
  expect(Object.keys(responseWindows('chronicle', bare))).toEqual(['fx-book-signs']);
});
