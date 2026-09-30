import { textSlack } from './textSlack';

// A model of Yoga 0.86 text rounding (yoga/algorithm/PixelGrid.cpp): the top is floored, the bottom is floored when the
// height is whole in device pixels and ceiled otherwise, and both are stored as 32-bit floats before they are subtracted.
function gridded(value: number, scale: number, ceil: boolean): number {
  const scaled = value * scale;
  const fraction = scaled - Math.floor(scaled);
  const snapped = fraction < 0.0001 ? Math.floor(scaled) : fraction > 0.9999 ? Math.ceil(scaled) : ceil ? Math.ceil(scaled) : Math.floor(scaled);
  return Math.fround(snapped / scale);
}
function drawnContentHeight(top: number, measured: number, paddingBottom: number, scale: number): number {
  const height = measured + paddingBottom;
  const fractional = Math.abs(Math.round(height * scale) - height * scale) > 0.0001;
  return Math.fround(gridded(top + height, scale, fractional) - gridded(top, scale, false)) - paddingBottom;
}
// TextKit dropped the last line once the container was 1.2e-4 pt short (macOS check, 2026-09-30).
const tolerance = 0.0001;
const tops = Array.from({ length: 6000 }, (_, index) => 1024 + index / 3 + 0.05);

test.each([1, 2, 3])('at pixel ratio %i the slack is a fraction of one device pixel', ratio => {
  const pixels = textSlack(ratio).paddingBottom * ratio;
  expect(pixels).toBeGreaterThan(0);
  expect(pixels).toBeLessThan(1);
});

// Native check, 2026-09-30, iPhone 18 Pro, largest text size, Polish: the declaration measured 8 lines of 63.75 pt (1530 px),
// drew 7 and clipped the rest of the text on the seventh. A float step short of 510 pt is enough for that.
test.each([510, 150])('a pixel-exact %i pt text past 1024 pt can come back short at ratio 3', measured => {
  expect(tops.some(top => drawnContentHeight(top, measured, 0, 3) < measured - tolerance)).toBe(true);
});

test.each([[510, 3], [150, 3], [120, 2], [510, 1]])('with the slack a pixel-exact %i pt text at ratio %i keeps room for its last line', (measured, scale) => {
  const padding = textSlack(scale).paddingBottom;
  for (const top of tops) expect(drawnContentHeight(top, measured, padding, scale)).toBeGreaterThan(measured + 0.1);
});
