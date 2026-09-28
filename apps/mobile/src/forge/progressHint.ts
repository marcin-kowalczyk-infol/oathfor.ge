/** The counts behind Żaromir's hint and counters. null means no usable answer for the active character. */
export type ForgeProgress = { today: { total: number; paused: boolean } | null; history: { total: number } | null; loading: boolean };

/** One hint line, first match wins (docs/product/forge-scene.md "Hint and counters"). The counters carry the numbers. */
export function progressHint({ today }: ForgeProgress): { key: string } {
  if (!today) return { key: 'room.talk.hint.unavailable' };
  if (today.paused) return { key: 'room.talk.hint.paused' };
  if (today.total === 0) return { key: 'room.talk.hint.none' };
  return { key: 'room.talk.hint.current' };
}
