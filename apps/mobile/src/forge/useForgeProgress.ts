import { useCallback, useEffect, useRef, useState } from 'react';
import type { OathController } from '../oaths/controller';
import type { ForgeProgress } from './progressHint';

type ListResult = Awaited<ReturnType<OathController['list']>>;

/**
 * Current Oaths and chronicle entries of the active character for Żaromir's statistics, from the same Oath list totals as the menu.
 * Nothing loads until refresh. While a refresh runs the last answers stay, and only the newest refresh applies.
 */
export function useForgeProgress(controller: Pick<OathController, 'list'>, characterId: string) {
  const [progress, setProgress] = useState<ForgeProgress>({ today: null, history: null, loading: false });
  const latest = useRef(0);
  useEffect(() => () => { latest.current++; }, []);
  const refresh = useCallback(() => {
    const request = ++latest.current;
    setProgress(current => ({ ...current, loading: true }));
    // An answer is used only when it names the active character, so a switch never shows another character's counts.
    const own = (result: ListResult) => result.kind === 'success' && result.value.characterId === characterId ? result.value : null;
    const load = (view: 'today' | 'history') => controller.list({ view, limit: 1 }).then(own, () => null);
    void Promise.all([load('today'), load('history')]).then(([today, history]) => {
      if (request !== latest.current) return;
      setProgress({ today: today && { total: today.total, paused: today.paused }, history: history && { total: history.total }, loading: false });
    });
  }, [controller, characterId]);
  return { progress, refresh };
}
