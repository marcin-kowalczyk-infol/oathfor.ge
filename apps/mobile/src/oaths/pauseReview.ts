import type { OathResult } from '../api/oaths';
import type { Oath, PauseEnvelope } from '../api/oathSchema';
import type { OathController } from './controller';

export type PauseReview = { summary: PauseEnvelope; withdraw: Oath[]; preserve: Oath[] };
type Failure = Exclude<OathResult<never>, { kind: 'success' }>;

export async function loadPauseReview(client: Pick<OathController, 'getPause' | 'detail'>): Promise<OathResult<PauseReview>> {
  try {
    const result = await client.getPause();
    if (result.kind !== 'success') return result;
    const summary = result.value;
    const ids = [...summary.withdraw, ...summary.preserve];
    const items: Oath[] = new Array(ids.length);
    let next = 0;
    let failure: Failure | undefined;
    async function worker() {
      while (!failure && next < ids.length) {
        const index = next++;
        try {
          const detail = await client.detail(ids[index]);
          if (detail.kind !== 'success') { failure ??= detail; return; }
          if (detail.value.oath.id !== ids[index]) { failure ??= { kind: 'unavailable', retry: 'request' }; return; }
          items[index] = detail.value.oath;
        } catch { failure ??= { kind: 'unavailable', retry: 'request' }; return; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, ids.length) }, () => worker()));
    if (failure) return failure;
    return { kind: 'success', value: { summary, withdraw: items.slice(0, summary.withdraw.length), preserve: items.slice(summary.withdraw.length) } };
  } catch { return { kind: 'unavailable', retry: 'request' }; }
}
