import { wallTimeIn } from '../oaths/compactStoredTime';
import type { ZaromirSituation } from '../oaths/oathPath';

/**
 * Lines per situation (docs/product/clarity.md decision 8). Frequent situations have four or five, rare ones two or three,
 * review and the interrupted upload exactly one. The catalogs hold `zaromir.<situation>.<n>` for n below the size.
 */
export const ZAROMIR_POOLS: Record<ZaromirSituation, number> = {
  scheduled: 4, active: 5, activeSoon: 4, cutoff: 3, interrupted: 1, assessing: 4, review: 1,
  fulfilled: 4, missed: 3, unresolved: 2, withdrawn: 2, confirmed: 3, confirmedScheduled: 2, proofScreen: 3,
};

/** A stable index below `size` from the 32-bit FNV-1a hash of the seed. */
export function pickLine(seed: string, size: number): number {
  if (!(size >= 1)) throw new RangeError(`Pool size must be at least 1, got ${size}`);
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  return (hash >>> 0) % size;
}

/** The same Oath in the same situation keeps its line for the Oath's local day. Without a server clock it keeps it always. */
export function zaromirSeed(oathId: string, situation: ZaromirSituation, serverNow: number | null, timezone: string): string {
  if (serverNow === null) return `${oathId}:${situation}`;
  return `${oathId}:${situation}:${wallTimeIn(new Date(serverNow).toISOString(), timezone).slice(0, 10)}`;
}
