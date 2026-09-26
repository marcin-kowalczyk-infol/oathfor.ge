import { useCallback, useEffect, useRef, useState } from 'react';
import type { OathController } from '../oaths/controller';

export type OathSummaryState = { kind: 'loading' } | { kind: 'ready'; total: number; paused: boolean; characterId: string } | { kind: 'failed' };

// Current Oaths count and pause flag for the menu. The server owns the total. Failures wait for the next refresh.
// A ready answer names its character, so a count of the previous character is never shown after a switch.
export function useOathSummary(controller: Pick<OathController, 'list'>): { state: OathSummaryState; refresh: () => void } {
  const [state, setState] = useState<OathSummaryState>({ kind: 'loading' });
  const latest = useRef(0);
  const refresh = useCallback(() => {
    const request = ++latest.current;
    setState({ kind: 'loading' });
    const settle = (next: OathSummaryState) => { if (request === latest.current) setState(next); };
    controller.list({ view: 'today', limit: 1 }).then(
      result => settle(result.kind === 'success' ? { kind: 'ready', total: result.value.total, paused: result.value.paused, characterId: result.value.characterId } : { kind: 'failed' }),
      () => settle({ kind: 'failed' }),
    );
  }, [controller]);
  useEffect(() => {
    refresh();
    return () => { latest.current++; };
  }, [refresh]);
  return { state, refresh };
}
