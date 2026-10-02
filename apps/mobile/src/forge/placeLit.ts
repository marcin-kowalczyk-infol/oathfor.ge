import type { ScenePlace } from './sceneLayout';

/** The server totals behind the room's light, as useForgeProgress reads them. null means no usable answer. */
export type PlaceCounts = { today: number | null; history: number | null };

/**
 * Whether a room place glows (docs/product/engagement.md E2, D-E7). A place lights when it has something:
 * the seals with a current Oath, the chronicle with an entry. The hearth and the door always glow.
 * Unknown counts fail open, so the player is never locked out of a place.
 */
export function placeLit(place: ScenePlace, { today, history }: PlaceCounts): boolean {
  if (today === null || history === null) return true;
  if (place === 'seals') return today > 0;
  if (place === 'chronicle') return history > 0;
  return true;
}
