import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Animated, Dimensions, PixelRatio, StyleSheet } from 'react-native';
import { DialoguePanel, TYPE_MS } from './DialoguePanel';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';

type Props = Parameters<typeof DialoguePanel>[0];
const frame = { left: 16, width: 343, bottom: 20, maxHeight: 300 };
const line = 'Touch the glowing hearth.';
const panel = (props: Partial<Props> = {}, locale: Locale = 'en') => <LocalizationProvider initialLocale={locale}>
  <DialoguePanel frame={frame} speaker="guide" lineId="a" text={line} playerName="Mira" portrait={null} allowed more={false}
    continueLabel="Next" onContinue={jest.fn()} dismissLabel="Close" onDismiss={jest.fn()} {...props} />
</LocalizationProvider>;
const hidden = { includeHiddenElements: true };
const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style) as Record<string, number | string>;
const shownText = () => {
  const text = screen.getByTestId('dialogue-text');
  // The typed part is the first child, the rest keeps its place invisibly.
  return (text.props.children as unknown[])[0] as string;
};

beforeEach(() => {
  jest.useFakeTimers();
  Dimensions.set({ window: { width: 375, height: 667, scale: 2, fontScale: 1 }, screen: { width: 375, height: 667, scale: 2, fontScale: 1 } });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('types the line and completes it on the first touch', async () => {
  const onContinue = jest.fn();
  await render(panel({ onContinue, more: true }));
  expect(shownText()).toBe('');
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 5); });
  expect(shownText()).toBe('Touch');
  expect(screen.queryByTestId('dialogue-rune-mark', hidden)).toBeNull();
  await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
  expect(shownText()).toBe(line);
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.getByTestId('dialogue-rune-mark', hidden)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test('typing counts graphemes, so Polish letters and joined emoji are never split', async () => {
  await render(panel({ text: 'Z\u0307ar 👨‍👩‍👧 ognia' }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 2); });
  expect(shownText()).toBe('Z\u0307a');
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 3); });
  expect(shownText()).toBe('Z\u0307ar 👨‍👩‍👧');
});

// Review finding: motion turns off while the app is in the background. A line shown whole must not go back to partial.
test('a line shown whole while motion was off stays whole when motion returns', async () => {
  const view = await render(panel({ more: true }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 5); });
  await view.rerender(panel({ more: true, allowed: false }));
  await view.rerender(panel({ more: true }));
  expect(shownText()).toBe(line);
  expect(screen.getByTestId('dialogue-rune-mark', hidden)).toBeTruthy();
});

// Review finding: a new text under the same id, for example after a language change, stopped typing at the old length.
test('a new text under the same line id types to its end', async () => {
  const view = await render(panel({ text: 'Short.' }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 3); });
  await view.rerender(panel({ text: 'A much longer line.' }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 40); });
  expect(shownText()).toBe('A much longer line.');
});

test('the rune continues for VoiceOver and stays in place while the next line types', async () => {
  const onContinue = jest.fn();
  const view = await render(panel({ more: true, onContinue }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
  expect(screen.queryByTestId('dialogue-rune-mark', hidden)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(shownText()).toBe(line);
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(onContinue).toHaveBeenCalledTimes(1);
  await view.rerender(panel({ more: true, onContinue, lineId: 'b' }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
});

test('a line with its own step control shows no rune over it', async () => {
  await render(panel({ allowed: false, more: true, controls: { step: { count: '1 / 4', label: 'Next', mark: '→', onPress: jest.fn() } } }));
  expect(screen.queryByTestId('dialogue-rune', hidden)).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Next' })).toHaveLength(1);
});

test('a new line starts typing again', async () => {
  const view = await render(panel());
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 100); });
  expect(shownText()).toBe(line);
  await view.rerender(panel({ lineId: 'b', text: 'Next line.' }));
  expect(shownText()).toBe('');
});

test('the last line shows its controls and no rune', async () => {
  const onPress = jest.fn();
  await render(panel({ allowed: false, controls: { action: { label: 'Shape an Oath', onPress } } }));
  expect(screen.queryByTestId('dialogue-rune', hidden)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Shape an Oath' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test.each([['en', 'Zharomir'], ['pl', 'Żaromir']] as const)('in %s Żaromir speaks from the left with his name on the plate', async (locale, name) => {
  await render(panel({}, locale));
  expect(screen.getByTestId('bust-guide', hidden)).toBeTruthy();
  expect(screen.getByTestId('dialogue-plate', hidden)).toHaveTextContent(name);
  expect(style('dialogue-plate').left).toBeDefined();
  expect(style('dialogue-plate').right).toBeUndefined();
  expect(style('bust-guide').left).toBeDefined();
});

test('the player speaks from the right with the character name and portrait', async () => {
  const portrait = 7;
  await render(panel({ speaker: 'player', portrait }));
  expect(screen.getByTestId('dialogue-plate', hidden)).toHaveTextContent('Mira');
  expect(style('dialogue-plate').right).toBeDefined();
  expect(style('bust-player').right).toBeDefined();
  expect(screen.getByTestId('bust-player-image', hidden).props.source).toBe(portrait);
});

test('VoiceOver reads the speaker and the whole line from the first frame, busts are hidden', async () => {
  await render(panel());
  expect(screen.getByTestId('dialogue-text').props.accessibilityLabel).toBe(`Zharomir: ${line}`);
  expect(screen.queryByTestId('bust-guide')).toBeNull();
  expect(screen.getByTestId('bust-guide', hidden)).toBeTruthy();
});

test('the bottom edge is fixed and a taller text grows the panel up to its limit', async () => {
  await render(panel({ text: 'A long line. '.repeat(30) }));
  const box = style('dialogue-panel');
  expect(box.bottom).toBe(20);
  expect(box.maxHeight).toBe(300);
  expect(box.top).toBeUndefined();
});

test('at normal size a text taller than the panel scrolls instead of pushing the bottom edge', async () => {
  await render(panel());
  const scroll = StyleSheet.flatten(screen.getByTestId('dialogue-scroll').props.style) as { flexGrow: number; flexShrink: number };
  expect(scroll).toMatchObject({ flexGrow: 0, flexShrink: 1 });
});

test('large text scrolls inside a fixed height', async () => {
  Dimensions.set({ window: { width: 375, height: 667, scale: 2, fontScale: 1.5 }, screen: { width: 375, height: 667, scale: 2, fontScale: 1.5 } });
  await render(panel());
  expect(style('dialogue-panel').height).toBe(300);
  expect(screen.getByTestId('dialogue-scroll')).toBeTruthy();
});

// Native check, 2026-09-30: on iOS a scroll view does not drag while a view above it holds the touch, so a drag in a long line
// acted as a tap and skipped the line. The touch target sits inside the scroll view and nothing around it takes the touch.
test.each([1, 3.12])('at text scale %d a drag in the text scrolls it instead of continuing', async fontScale => {
  Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale }, screen: { width: 402, height: 874, scale: 3, fontScale } });
  const onContinue = jest.fn();
  await render(panel({ allowed: false, more: true, onContinue, title: 'The hearth' }));
  const scroll = screen.getByTestId('dialogue-scroll');
  type Node = { parent: Node | null; props: Record<string, unknown> };
  for (let node = (scroll as unknown as Node).parent; node; node = node.parent) {
    expect(node.props.onStartShouldSetResponder).toBeUndefined();
    expect(node.props.onResponderGrant).toBeUndefined();
  }
  const touch = within(scroll).getByTestId('dialogue-panel-touch');
  await fireEvent.press(touch);
  expect(onContinue).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText('The hearth'));
  expect(onContinue).toHaveBeenCalledTimes(2);
});

test('at large text the touch fills the scroll area, so a tap below a short line continues', async () => {
  Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale: 3.12 }, screen: { width: 402, height: 874, scale: 3, fontScale: 3.12 } });
  await render(panel({ allowed: false }));
  expect(StyleSheet.flatten(screen.getByTestId('dialogue-scroll').props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
  expect(StyleSheet.flatten(screen.getByTestId('dialogue-panel-touch').props.style)).toMatchObject({ flexGrow: 1 });
});

test('a new speaker slides the old bust out and the new one in', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(panel());
  timing.mockClear();
  await view.rerender(panel({ speaker: 'player', lineId: 'b' }));
  const swaps = timing.mock.calls.filter(([, config]) => config.duration === 220).map(([, config]) => config.toValue);
  expect(swaps).toEqual([0, 1]);
});

test('with reduced motion the new bust and the whole line show at once', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(panel({ allowed: false }));
  expect(shownText()).toBe(line);
  await view.rerender(panel({ allowed: false, speaker: 'player', lineId: 'b', text: 'How am I doing?' }));
  expect(timing.mock.calls.filter(([, config]) => config.duration === 220)).toHaveLength(0);
  expect(shownText()).toBe('How am I doing?');
  expect(style('bust-player').opacity).toBe(1);
  expect(style('bust-guide').opacity).toBe(0);
});

test('every control is at least 44 points', async () => {
  await render(panel({ allowed: false, controls: {
    action: { label: 'Shape an Oath', onPress: jest.fn() },
    step: { count: '2 / 4', label: 'Another place', text: true, onPress: jest.fn() },
  } }));
  for (const name of ['Shape an Oath', 'Another place', 'Close']) {
    const box = StyleSheet.flatten(screen.getByRole('button', { name }).props.style) as { height?: number; minHeight?: number; width?: number; minWidth?: number };
    expect(Math.max(box.height ?? 0, box.minHeight ?? 0)).toBeGreaterThanOrEqual(44);
  }
  expect(screen.getByText('2 / 4')).toBeOnTheScreen();
});

describe('painted frame', () => {
  test('draws the painted corners, tiled braid edges, wood and plate', async () => {
    await render(panel({ allowed: false }));
    const corner = require('../../assets/forge/scene/panel-corner-v01.png');
    for (const id of ['tl', 'tr', 'bl', 'br']) expect(screen.getByTestId(`panel-corner-${id}`, hidden).props.source).toBe(corner);
    const edge = require('../../assets/forge/scene/panel-edge-h-v01.png');
    const tiles = screen.getAllByTestId('panel-edge-top-tile', hidden);
    // A 343 point panel minus two 32 point corners needs six 47 point tiles, never a stretched frame.
    expect(tiles).toHaveLength(Math.ceil((343 - 64) / (142 / 3)));
    for (const tile of tiles) expect(tile.props.source).toBe(edge);
    expect(screen.getAllByTestId('panel-edge-left-tile', hidden).length).toBeGreaterThan(0);
    expect(screen.getByTestId('panel-fill', hidden).props.source).toBe(require('../../assets/forge/scene/panel-fill-v01.png'));
    const plate = screen.getByTestId('dialogue-plate-image', hidden);
    expect(plate.props.source).toBe(require('../../assets/forge/scene/panel-plate-v01.png'));
    // The plate keeps its painted proportions, so its caps never stretch.
    const box = StyleSheet.flatten(plate.props.style) as { width: number; height: number };
    expect(box.width / box.height).toBeCloseTo(612 / 128);
  });

  // Native check, 2026-09-30: the covering wood image drew past the panel to the screen's right and bottom edges on iOS.
  test('the wood is clipped to the inside of the frame', async () => {
    await render(panel({ allowed: false }));
    const fill = screen.getByTestId('panel-fill', hidden);
    expect(StyleSheet.flatten(fill.props.style)).toMatchObject({ width: '100%', height: '100%' });
    expect(style('panel-fill-clip')).toMatchObject({ position: 'absolute', left: 4, top: 4, right: 4, bottom: 4, overflow: 'hidden' });
    expect(fill.parent?.props.testID ?? (fill.parent?.parent as { props: { testID?: string } } | undefined)?.props.testID).toBe('panel-fill-clip');
  });

  test('Żaromir speaks with his painted bust', async () => {
    await render(panel());
    expect(screen.getByTestId('bust-guide-image', hidden).props.source).toBe(require('../../assets/forge/scene/zharomir-bust-v01.png'));
  });

  test('the rune is the painted pulse', async () => {
    await render(panel({ allowed: false, more: true }));
    expect(screen.getByTestId('dialogue-rune-mark', hidden)).toBeTruthy();
    // Native check on iPhone 18 Pro (MVP-20-T15): a screen blend inside the panel drew a dark square, so the rune carries its own alpha.
    expect(screen.getByTestId('dialogue-rune-image', hidden).props.source).toBe(require('../../assets/forge/scene/panel-rune-alpha-v01.png'));
    const mark = StyleSheet.flatten(screen.getByTestId('dialogue-rune-mark', hidden).props.style) as { mixBlendMode?: string };
    expect(mark.mixBlendMode).toBeUndefined();
  });
});

// Native check on iPhone 18 Pro (MVP-20-T15): the step counter and × sat on the painted braid.
test('the counter and the close control sit inside the painted band', async () => {
  await render(panel({ allowed: false, controls: { step: { count: '1 / 4', label: 'Next', mark: '→', onPress: jest.fn() } } }));
  const band = 17;
  const row = StyleSheet.flatten(screen.getByText('1 / 4').parent!.parent!.props.style) as { paddingLeft?: number; paddingHorizontal?: number };
  expect((row.paddingLeft ?? 0) + (row.paddingHorizontal ?? 0)).toBeGreaterThanOrEqual(band);
  const close = StyleSheet.flatten(screen.getByRole('button', { name: 'Close' }).props.style) as { top: number; right: number };
  expect(Math.min(close.top, close.right)).toBeGreaterThanOrEqual(band - 44 / 2 + 8);
});

// Owner review 2026-09-28: the player's bust hid behind the text field. Both busts are drawn over the painted frame.
test.each(['player', 'guide'] as const)('draws the %s bust above the painted frame and clear of the text', async speaker => {
  await render(panel({ speaker }));
  const children = screen.getByTestId('dialogue-panel', hidden).children as { props: { testID?: string } }[];
  const at = (id: string) => children.findIndex(child => child.props.testID === id);
  expect(at('panel-frame')).toBeGreaterThanOrEqual(0);
  expect(at('bust-guide')).toBeGreaterThan(at('panel-frame'));
  expect(at('bust-player')).toBeGreaterThan(at('panel-frame'));
  const bust = style(`bust-${speaker}`);
  expect(Number(bust.top) + Number(bust.height)).toBeLessThanOrEqual(Number(style('dialogue-panel').paddingTop));
});

// MVP-22-B2 (G11), native check on iPhone 18 Pro: the continue mark was a dark bronze chevron cramped under the ×.
describe('the continue mark', () => {
  test('takes the × glyph colour and its own 44 pt row under the text', async () => {
    await render(panel({ allowed: false, more: true }));
    const cream = (StyleSheet.flatten(screen.getByText('×', hidden).props.style) as { color: string }).color;
    expect(StyleSheet.flatten(screen.getByTestId('dialogue-rune-image', hidden).props.style)).toMatchObject({ tintColor: cream });
    const rune = screen.getByRole('button', { name: 'Next' });
    expect(StyleSheet.flatten(rune.props.style)).toMatchObject({ width: 44, height: 44 });
    expect(StyleSheet.flatten(rune.props.style)).not.toHaveProperty('position', 'absolute');
    const row = style('dialogue-rune-row');
    expect(row).toMatchObject({ height: 44, alignItems: 'flex-end' });
    expect(row.position).toBeUndefined();
  });

  test('a line without a following line keeps no empty row', async () => {
    await render(panel({ allowed: false, more: false }));
    expect(screen.queryByTestId('dialogue-rune-row', hidden)).toBeNull();
  });
});

// MVP-22-B2 (G11): a hairline crossed both side braids where the edge strips met the lower corners at a fractional pixel row.
// MVP-22 G28, native check on iPhone 18 Pro: the one pixel overlap that followed drew a dark line at both lower junctions,
// because corner and strip carry the same translucent inner shadow and it was drawn twice. The strips now end exactly at the
// corners and the panel's edges are whole device pixels, so the junction is a whole pixel.
describe('the braid strips meet the corners', () => {
  const whole = (points: number) => expect(points * 3).toBeCloseTo(Math.round(points * 3), 6);
  const strip = (id: string) => StyleSheet.flatten(screen.getAllByTestId(id, hidden)[0].parent!.props.style) as Record<string, number>;
  const tile = (id: string) => StyleSheet.flatten(screen.getAllByTestId(id, hidden)[0].props.style) as Record<string, number>;

  test('end exactly at the corners, with no overlap', async () => {
    await render(panel({ allowed: false }));
    const corner = Number(style('panel-corner-tl').width);
    for (const id of ['panel-edge-left-tile', 'panel-edge-right-tile']) expect(strip(id)).toMatchObject({ top: corner, bottom: corner });
    for (const id of ['panel-edge-top-tile', 'panel-edge-bottom-tile']) expect(strip(id)).toMatchObject({ left: corner, right: corner });
  });

  // On a 3x screen a fractional frame snaps its edges, and the corner and braid sizes are whole pixels too, so every junction where
  // a strip meets a corner lands on a whole device pixel.
  test.each([1, 2])('a fractional frame on a 3x screen puts every corner junction on a whole device pixel at font scale %s', async fontScale => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
    Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale }, screen: { width: 402, height: 874, scale: 3, fontScale } });
    await render(panel({ allowed: false, frame: { left: 16.4, width: 370.3, bottom: 20.1, maxHeight: 300.05 } }));
    const box = style('dialogue-panel') as Record<string, number>;
    for (const edge of [box.left, box.left + box.width, box.bottom, box.maxHeight]) whole(edge);
    const corner = Number(style('panel-corner-tl').width);
    for (const size of [corner, tile('panel-edge-top-tile').height, tile('panel-edge-top-tile').width, tile('panel-edge-left-tile').width, tile('panel-edge-left-tile').height]) whole(size);
    // The horizontal strips start and end at the corners, the vertical ones too, measured from the panel's snapped edges.
    for (const junction of [box.left + corner, box.left + box.width - corner, box.bottom + corner, box.bottom + box.maxHeight - corner]) whole(junction);
    // Large text fixes the panel's height at its limit, so that height is whole too.
    if (fontScale > 1.3) whole(box.height);
    expect(box.left).toBeCloseTo(16.4, 0);
    expect(box.left + box.width).toBeCloseTo(16.4 + 370.3, 0);
  });
});
