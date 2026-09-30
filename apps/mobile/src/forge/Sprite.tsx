import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { frameCount, type Sheet } from './motion';

const size = (sheet: Sheet, width?: number, height?: number) => width !== undefined
  ? { width, height: width / sheet.aspect }
  : { width: (height ?? 0) * sheet.aspect, height: height ?? 0 };

const sheetImage = (sheet: Sheet, index: number, width: number, height: number) => ({
  position: 'absolute' as const, width: width * sheet.cols, height: height * sheet.rows,
  left: -(index % sheet.cols) * width, top: -Math.floor(index / sheet.cols) * height,
});

const hidden = { pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/** One cell of a sheet. Give a width or a height, the other follows the cell shape. */
export function SpriteFrame({ sheet, index, width, height, testID, style, onLoad }: {
  sheet: Sheet; index: number; width?: number; height?: number; testID?: string; style?: StyleProp<ViewStyle>; onLoad?: () => void;
}) {
  const cell = size(sheet, width, height);
  // Native check: a screen blend on the clipping view itself rendered black boxes. The blend sits on an unclipped wrapper.
  return <View {...hidden} style={[cell, sheet.blend === 'screen' && styles.screen, style]}>
    <View testID={testID} style={[styles.cell, cell]}>
      <Image source={sheet.source} resizeMode="stretch" onLoad={onLoad} style={sheetImage(sheet, index, cell.width, cell.height)} />
    </View>
  </View>;
}

/** Every frame as its own layer. The phase value decides which layers show, on the native driver. */
function Layers({ sheet, width, opacity, testID, style, children }: {
  sheet: Sheet; width: number; opacity: (frame: number) => Animated.AnimatedInterpolation<number> | number;
  testID?: string; style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>; children?: ReactNode;
}) {
  const cell = size(sheet, width);
  // A screen blend mixes with the siblings drawn before it. Its parent must not be a transparent or transformed group.
  return <Animated.View {...hidden} testID={testID} style={[styles.anchor, cell, sheet.blend === 'screen' && styles.screen, style]}>
    {Array.from({ length: frameCount(sheet) }, (_, frame) => <Animated.View key={frame} style={[styles.cell, styles.layer, cell, { opacity: opacity(frame) }]}>
      <Animated.Image source={sheet.source} resizeMode="stretch" style={sheetImage(sheet, frame, cell.width, cell.height)} />
    </Animated.View>)}
    {children}
  </Animated.View>;
}

/** A seamless loop, crossfaded for light and stepped for solid sheets. Reduced motion shows the first frame still. */
export function SpriteLoop({ sheet, width, duration, allowed, testID, style }: {
  sheet: Sheet; width: number; duration: number; allowed: boolean; testID?: string; style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
}) {
  const frames = frameCount(sheet);
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.stopAnimation(); phase.setValue(0);
    if (!allowed) return;
    const loop = Animated.loop(Animated.timing(phase, { toValue: frames, duration, easing: Easing.linear, isInteraction: false, useNativeDriver: true }));
    loop.start();
    return () => { loop.stop(); phase.stopAnimation(); phase.setValue(0); };
  }, [allowed, duration, frames, phase]);
  return <Layers sheet={sheet} width={width} testID={testID} style={style} opacity={loopOpacity(sheet, phase)} />;
}

/** Light fades between neighbouring frames. Solid sheets step, so their opaque art never shows at half strength. */
export const loopOpacity = (sheet: Sheet, phase: Animated.Value) => {
  const frames = frameCount(sheet);
  if (sheet.blend === 'normal') {
    // Each frame fades in over the one before it and out under the one after it, so one frame is always whole.
    const edge = 0.02;
    return (frame: number) => phase.interpolate(frame === 0
      ? { inputRange: [0, 1, 1 + edge], outputRange: [1, 1, 0], extrapolate: 'clamp' }
      : frame === frames - 1
        ? { inputRange: [frame - edge, frame, frames], outputRange: [0, 1, 1], extrapolate: 'clamp' }
        : { inputRange: [frame - edge, frame, frame + 1, frame + 1 + edge], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  }
  return (frame: number) => phase.interpolate(frame === 0
    ? { inputRange: [0, 1, frames - 1, frames], outputRange: [1, 0, 0, 1], extrapolate: 'clamp' }
    : { inputRange: [frame - 1, frame, frame + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' });
};

/**
 * Plays a sheet once while progress runs through [start, end] of 0 to 1. Outside the window nothing shows.
 * Light fades between frames. Solid sheets step, so a turning page never shows two pages at once.
 */
export function SpriteSequence({ sheet, width, progress, start = 0, end = 1, testID, style }: {
  sheet: Sheet; width: number; progress: Animated.Value; start?: number; end?: number; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const frames = frameCount(sheet);
  const length = (end - start) / frames;
  const step = sheet.blend === 'normal';
  return <Layers sheet={sheet} width={width} testID={testID} style={style} opacity={frame => {
    const from = start + frame * length;
    if (step) {
      // The first frame rises out of the scene and the last settles back into it, so the object never pops in or out.
      const fadeIn = frame === 0 ? length * 0.8 : length * 0.02;
      const fadeOut = frame === frames - 1 ? length * 0.8 : length * 0.02;
      return progress.interpolate({ inputRange: [from, from + fadeIn, from + length - fadeOut, from + length], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
    }
    // Light fades between neighbouring frames. The first rises from start and the last is gone by end, so nothing stays drawn.
    const centre = from + length / 2;
    const rise = frame === 0 ? start : centre - length;
    const fall = frame === frames - 1 ? end : centre + length;
    return progress.interpolate({ inputRange: [rise, centre, fall], outputRange: [0, 1, 0], extrapolate: 'clamp' });
  }} />;
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute' },
  cell: { overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, top: 0 },
  screen: { mixBlendMode: 'screen' },
});
