import { useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import type { ServerClock } from './serverClock';
import { MINUTE, type CountdownTarget } from './countdown';

/**
 * Milliseconds left to the target in server time, or null without server time or target.
 * Renders again whenever the whole minutes left change (so the text is never stale, also for targets with seconds),
 * on a new envelope and
 * on return to the foreground. onElapsed runs once when zero is reached on screen, never for a target already past.
 */
export function useCountdown(target: CountdownTarget | null, clock: ServerClock, onElapsed?: () => void): number | null {
  const [, render] = useReducer((value: number) => value + 1, 0);
  const seenPositive = useRef<string | null>(null);
  const fired = useRef<string | null>(null);
  const elapsed = useRef(onElapsed); elapsed.current = onElapsed;
  useEffect(() => clock.subscribe(render), [clock]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') render(); });
    return () => subscription.remove();
  }, []);
  const now = clock.now();
  const remaining = target && now !== null ? target.at - now : null;
  const key = target ? `${target.kind}:${target.at}` : null;
  useEffect(() => {
    if (remaining === null || key === null || now === null) return;
    if (remaining > 0) {
      seenPositive.current = key;
      // The shown whole minutes drop just after remaining passes a multiple of a minute, or at the target itself.
      const timer = setTimeout(render, Math.min(remaining, (remaining % MINUTE) + 1));
      return () => clearTimeout(timer);
    }
    if (seenPositive.current === key && fired.current !== key) { fired.current = key; elapsed.current?.(); }
  }, [key, remaining, now]);
  return remaining;
}
