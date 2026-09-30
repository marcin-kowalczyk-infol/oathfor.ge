import { PixelRatio } from 'react-native';

/**
 * Half a device pixel of bottom padding, which the shared Text (ui/Text.tsx) adds below every outermost text.
 *
 * The measured height is rounded up to whole device pixels, and with a line height it often has no fraction to spare.
 * Yoga (React Native 0.86) then floors both edges and subtracts them as 32-bit floats, so past about 1024 pt of scroll
 * content the text can get 1e-4 pt less than it measured. TextKit then fits one line fewer and clips the rest of the text
 * on the last line (native check, 2026-09-30, iPhone 18 Pro). A fractional padding makes Yoga ceil the bottom edge
 * instead, which leaves the text at least half a device pixel to spare.
 */
export function textSlack(pixelRatio: number = PixelRatio.get()): { paddingBottom: number } {
  return { paddingBottom: 1 / (2 * pixelRatio) };
}
