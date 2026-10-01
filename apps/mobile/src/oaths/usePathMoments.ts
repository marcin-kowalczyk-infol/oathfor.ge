import { useEffect, useReducer, useRef } from 'react';
import type { Oath } from '../api/oathSchema';
import type { ServerClock } from './serverClock';

const HOUR = 3600000;
// A longer timeout overflows and fires at once, so far moments are reached in steps.
const LONGEST_TIMER = 2 ** 31 - 1;

/**
 * Re-renders the screen of an active Oath at the three moments its path line moves and no chip marks: under an hour before D,
 * just after D and just after S. oathPath compares strictly, so each moment is its boundary plus 1 ms. Just after D the line
 * changes on the device, also offline. Just after S it calls onClosed once, for example to ask the server again. Until the
 * server answers, the line already says the window closed. Shared by the detail and the proof screen (MVP-22-T12c).
 */
export function usePathMoments(oath: Oath | null, clock: ServerClock | undefined, onClosed?: (oathId: string) => void): void {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const closed = useRef(onClosed); closed.current = onClosed;
  useEffect(() => {
    if (!oath || oath.state !== 'active' || !clock) return;
    const oathId = oath.id, cutoff = Date.parse(oath.snapshot.deadline.receiptCutoff), deadline = Date.parse(oath.snapshot.deadline.utc);
    const moments = [deadline - HOUR + 1, deadline + 1, cutoff + 1];
    let timer: ReturnType<typeof setTimeout> | undefined;
    function arm() {
      clearTimeout(timer); timer = undefined;
      const now = clock!.now();
      const at = now === null ? undefined : moments.find(moment => moment > now);
      if (now === null || at === undefined) return;
      timer = setTimeout(() => {
        rerender();
        const later = clock!.now();
        if (later !== null && later > cutoff) closed.current?.(oathId); else arm();
      }, Math.min(at - now, LONGEST_TIMER));
    }
    const stop = clock.subscribe(arm); arm();
    return () => { clearTimeout(timer); stop(); };
  }, [oath, clock]);
}
