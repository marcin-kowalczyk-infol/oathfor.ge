import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import type { ScenePlace } from './sceneLayout';

export const FLIGHT_MS = 650;
/** A place action never delays its screen longer than this (docs/product/forge-scene.md "Place responses and camera"). */
export const FLIGHT_LIMIT_MS = 700;
const CROSSFADE_MS = 250;
// The motion preference arrives shortly after mount (useMotionAllowed). A return waits this long before it crossfades.
const PREFERENCE_WAIT_MS = 400;
// After the parent navigated away the room is gone. If it is still here after this delay, it returns to rest.
const RESET_MS = 100;
// About 1.9 times into a place. The door pulls the camera back instead.
const SCALE: Record<ScenePlace, number> = { hearth: 1.9, seals: 1.9, chronicle: 1.9, door: 0.8 };
const closeUps = {
  hearth: require('../../assets/forge/station-hearth-v01.jpg'),
  seals: require('../../assets/forge/station-seals-v01.jpg'),
  chronicle: require('../../assets/forge/station-chronicle-v01.jpg'),
};
// The close-up framing of SceneSurface: full width, 1.5 times as tall, the Today list lowered by 0.3 of the screen.
const DROP: Record<ScenePlace, number> = { hearth: 0, seals: 0.3, chronicle: 0, door: 0 };

/**
 * The camera flight between the room and a place's screen. `from` starts the room on that place's close-up and flies back.
 * fly() scales the room around the place over 650 ms and fades the close-up in over the last 200 ms, or crossfades in 250 ms
 * without motion. Its callback runs once, when the flight ends or at 700 ms, whichever comes first. A second fly is ignored.
 */
export function useCameraFlight({ allowed, from, onReturned }: { allowed: boolean; from: ScenePlace | null; onReturned?: () => void }) {
  const zoom = useRef(new Animated.Value(from ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(from ? 1 : 0)).current;
  const [place, setPlace] = useState<ScenePlace | null>(from);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const returning = useRef(!!from);
  const [mountedAt] = useState(() => Date.now());
  const [settled, setSettled] = useState(false);
  const rest = () => { zoom.setValue(0); fade.setValue(0); setPlace(null); };
  // The return flies back once motion is known to be allowed, or crossfades once the preference had time to arrive.
  useEffect(() => {
    if (!returning.current) return;
    if (!allowed && !settled) {
      const wait = setTimeout(() => setSettled(true), Math.max(0, PREFERENCE_WAIT_MS - (Date.now() - mountedAt)));
      return () => clearTimeout(wait);
    }
    const back = allowed
      ? Animated.timing(zoom, { toValue: 0, duration: FLIGHT_MS, easing: Easing.inOut(Easing.cubic), isInteraction: false, useNativeDriver: true })
      : Animated.timing(fade, { toValue: 0, duration: CROSSFADE_MS, isInteraction: false, useNativeDriver: true });
    back.start(({ finished }) => {
      if (!finished || !returning.current) return;
      returning.current = false;
      if (!running.current) rest();
      onReturned?.();
    });
    return () => back.stop();
  }, [allowed, settled]);
  useEffect(() => () => { alive.current = false; if (limit.current) clearTimeout(limit.current); }, []);
  function fly(target: ScenePlace, done: () => void) {
    if (running.current) return;
    running.current = true;
    returning.current = false;
    setBusy(true);
    setPlace(target);
    let called = false;
    // The parent navigates away in done. Resetting at once could flash the room before the next screen,
    // so a room still mounted after a moment returns to rest and can fly again.
    const finish = () => {
      if (called) return;
      called = true;
      if (limit.current) clearTimeout(limit.current);
      done();
      running.current = false;
      setBusy(false);
      setTimeout(() => { if (alive.current && !running.current) rest(); }, RESET_MS);
    };
    limit.current = setTimeout(finish, FLIGHT_LIMIT_MS);
    const flight = allowed
      ? Animated.timing(zoom, { toValue: 1, duration: FLIGHT_MS, easing: Easing.inOut(Easing.cubic), isInteraction: false, useNativeDriver: true })
      : Animated.timing(fade, { toValue: 1, duration: CROSSFADE_MS, isInteraction: false, useNativeDriver: true });
    flight.start(({ finished }) => { if (finished) finish(); });
  }
  const visible = allowed ? zoom.interpolate({ inputRange: [0, (FLIGHT_MS - 200) / FLIGHT_MS, 1], outputRange: [0, 0, 1] }) : fade;
  return {
    fly, place, busy,
    /** The scale of the whole room around a screen point. */
    scale: (origin: { left: number; top: number }) => place && allowed ? {
      transformOrigin: [origin.left, origin.top, 0],
      transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, SCALE[place]] }) }],
    } : null,
    /** The place's close-up, or darkness for the door, fading in over the room. */
    overlay: (viewport: { width: number; height: number }) => place ? <Animated.View testID="flight-closeup" pointerEvents="none"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, styles.dark, { opacity: visible }]}>
      {place !== 'door' && <>
        {/* The same close-up, shades and floor as SceneSurface, so the next screen starts on this very picture. */}
        <Image source={closeUps[place]} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: viewport.height * DROP[place], width: viewport.width, height: viewport.width * 1.5 }} />
        <View style={[styles.shade, { top: viewport.height * DROP[place], height: viewport.width * 1.5 }]} />
        {DROP[place] > 0 && <View style={[styles.rise, { top: 0, height: viewport.height * DROP[place] + viewport.width * 1.5 * 0.12 }]} />}
        <View style={[styles.floor, { top: viewport.height * DROP[place] + viewport.width * 1.5 - 1 }]} />
      </>}
    </Animated.View> : null,
  };
}

// Colours and gradients of SceneSurface (apps/mobile/src/ui/SceneSurface.tsx).
const styles = StyleSheet.create({
  dark: { backgroundColor: '#111315' },
  shade: { position: 'absolute', left: 0, right: 0, experimental_backgroundImage: 'linear-gradient(180deg, rgba(17,19,21,0.42) 0%, rgba(17,19,21,0.40) 30%, rgba(17,19,21,0.80) 52%, rgba(17,19,21,0.93) 72%, #111315 100%)' },
  rise: { position: 'absolute', left: 0, right: 0, experimental_backgroundImage: 'linear-gradient(180deg, #111315 0%, #111315 70%, rgba(17,19,21,0) 100%)' },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#111315' },
});
