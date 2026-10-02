import { createContext, forwardRef, useContext, type ComponentRef } from 'react';
import { StyleSheet, Text as NativeText, type TextProps, type TextStyle } from 'react-native';
import { textSlack } from './textSlack';
import type { Budget } from './wordBudget';

// True below an outermost Text. A nested Text is an inline span on iOS, where padding is not valid.
const InsideText = createContext(false);

/**
 * React Native's Text with half a device pixel of bottom padding on the outermost text.
 *
 * The slack keeps a float-short frame from dropping the last line (see textSlack.ts). It is added to the caller's own bottom
 * padding, resolved the way Yoga resolves it (paddingBottom, then paddingVertical, then padding). A percentage padding or a
 * fixed height or maxHeight keeps the caller's style as it is, because the slack would take room from the text there.
 *
 * `budget` marks text exempt from the screen word budget (wordBudget.ts). It rides on the native text as a prop the native
 * side ignores, so it adds no view and changes no accessibility.
 */
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps & { budget?: Budget }>(function Text({ style, children, budget, ...rest }, ref) {
  const nested = useContext(InsideText);
  const props = budget ? { ...rest, budget } : rest;
  if (nested) return <NativeText ref={ref} style={style} {...props}>{children}</NativeText>;
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};
  const bottom = flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 0;
  const fixed = [flat.height, flat.maxHeight].some(value => value != null && value !== 'auto');
  const padded = typeof bottom === 'number' && !fixed ? [style, { paddingBottom: bottom + textSlack().paddingBottom }] : style;
  // The provider wraps the native text from outside, so its children reach it as the caller passed them.
  return <InsideText.Provider value><NativeText ref={ref} style={padded} {...props}>{children}</NativeText></InsideText.Provider>;
});
Text.displayName = 'Text';
