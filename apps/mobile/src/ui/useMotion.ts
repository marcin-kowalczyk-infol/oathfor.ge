import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

/** Animation stays off until the system preference is known, and while backgrounded. */
export function useMotionAllowed(): boolean {
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
  return allowed;
}
