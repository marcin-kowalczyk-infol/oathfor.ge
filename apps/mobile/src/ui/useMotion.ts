import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

const Suspended = createContext(false);

/** A mounted but hidden subtree keeps its state while its loops stay stopped. */
export function MotionSuspended({ suspended, children }: { suspended: boolean; children: ReactNode }) {
  const outer = useContext(Suspended);
  return createElement(Suspended.Provider, { value: outer || suspended }, children);
}

/** Animation stays off until the system preference is known, and while backgrounded or hidden. */
export function useMotionAllowed(): boolean {
  const suspended = useContext(Suspended);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let mounted = true;
    let preferenceKnown = false;
    let reduced = true;
    let foreground = AppState.currentState === 'active';
    const update = () => { if (mounted) setAllowed(!reduced && foreground); };
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceKnown = true;
      reduced = value;
      update();
    });
    const app = AppState.addEventListener('change', value => { foreground = value === 'active'; update(); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      // A preference event is newer than the async startup snapshot.
      if (!mounted || preferenceKnown) return;
      reduced = value;
      update();
    }).catch(() => { /* Keep motion disabled if the preference is unavailable. */ });
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  return allowed && !suspended;
}

/**
 * The system Reduce Motion preference alone, true until it is known. Layout choices that must not flip with a system alert
 * (a permission prompt makes the app inactive for a moment) depend on this, not on useMotionAllowed (MVP-22-T12c).
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    let preferenceKnown = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { preferenceKnown = true; if (mounted) setReduced(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && !preferenceKnown) setReduced(value);
    }).catch(() => { /* Keep the steps open if the preference is unavailable. */ });
    return () => { mounted = false; motion.remove(); };
  }, []);
  return reduced;
}
