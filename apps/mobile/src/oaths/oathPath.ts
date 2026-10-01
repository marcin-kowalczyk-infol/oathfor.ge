import type { Oath, OathState } from '../api/oathSchema';
import { wallTimeIn } from './compactStoredTime';
import type { DeviceProof } from './deviceProof';

export type StepStatus = 'done' | 'current' | 'future' | 'skipped';
export type PathBadge = 'waiting' | 'interrupted' | 'assessing' | 'needsMore' | 'review' | 'result' | null;
/** `proofScreen`, `confirmed` and `confirmedScheduled` come from their screens, never from `oathPath`. */
export type ZaromirSituation = 'scheduled' | 'active' | 'activeSoon' | 'cutoff' | 'interrupted' | 'assessing' | 'review'
  | 'fulfilled' | 'missed' | 'unresolved' | 'withdrawn' | 'confirmed' | 'confirmedScheduled' | 'proofScreen';
/** A stored wall time in the Oath's zone, unformatted. */
export type PathTime = { local: string; timezone: string };
export type OathPath = {
  step: 1 | 2 | 3 | 4;
  steps: [StepStatus, StepStatus, StepStatus, StepStatus];
  badge: PathBadge;
  next: { key: string; time?: PathTime };
  action: null | 'submitProof' | 'sendAgain';
  zaromir: ZaromirSituation | null;
};

const HOUR = 3600000;
const assessment: Partial<Record<OathState, [PathBadge, string, ZaromirSituation | null]>> = {
  proof_pending: ['assessing', 'path.next.proofPending', 'assessing'],
  needs_more_evidence: ['needsMore', 'path.next.needsMoreEvidence', null],
  review_pending: ['review', 'path.next.reviewPending', 'review'],
};

/**
 * Where an Oath stands on the four steps (docs/product/clarity.md "Step track", decisions 1 to 8). Only server state, the device's own
 * proof record and the server clock count. `paused` null means unknown: a pause withdraws scheduled and active Oaths, so only they may hear Żaromir.
 */
export function oathPath(oath: Oath, device: DeviceProof, paused: boolean | null, now: number | null): OathPath {
  const zone = oath.snapshot.deadline.timezone;
  const at = (instant: string): PathTime => ({ local: wallTimeIn(instant, zone), timezone: zone });
  const own = ({ local, timezone }: PathTime): PathTime => ({ local, timezone });
  const speaks = paused === false || (paused === null && (oath.state === 'scheduled' || oath.state === 'active'));
  // While a send or delete runs nothing is asked and nothing is said.
  const busy = device === 'sending' || device === 'deleting';
  const path = (step: OathPath['step'], steps: OathPath['steps'], badge: PathBadge, next: OathPath['next'], action: OathPath['action'], zaromir: ZaromirSituation | null): OathPath =>
    ({ step, steps, badge, next, action: busy ? null : action, zaromir: speaks && !busy ? zaromir : null });

  if (oath.state === 'scheduled') return path(1, ['done', 'future', 'future', 'future'], 'waiting', { key: 'path.next.scheduled', time: own(oath.snapshot.activation.time!) }, null, 'scheduled');
  if (oath.state === 'active') {
    const deadline = Date.parse(oath.snapshot.deadline.utc), cutoff = Date.parse(oath.snapshot.deadline.receiptCutoff);
    const closed = now !== null && now > cutoff;
    const steps: OathPath['steps'] = ['done', 'current', 'future', 'future'];
    // An interrupted upload is urged only before the cutoff. After it the server's next answer decides.
    if (device === 'waiting') return path(2, steps, 'interrupted', { key: 'path.next.interrupted' }, 'sendAgain', closed ? null : 'interrupted');
    const late = now !== null && now > deadline;
    const situation = closed ? null : late ? 'cutoff' : now !== null && deadline - now < HOUR ? 'activeSoon' : 'active';
    return path(2, steps, null, { key: late ? 'path.next.cutoff' : 'path.next.active', time: own(oath.snapshot.deadline) }, 'submitProof', situation);
  }
  const pending = assessment[oath.state];
  if (pending) {
    const [badge, key, situation] = pending;
    const time = oath.state === 'review_pending' && oath.review ? { time: at(oath.review.closesAt) } : {};
    return path(3, ['done', 'done', 'current', 'future'], badge, { key, ...time }, null, situation);
  }
  // Terminal. Without a proof, or without a start, the workout and its assessment never happened.
  const reached: StepStatus = oath.proof === null || oath.activatedAt === null ? 'skipped' : 'done';
  const result = oath.state as 'fulfilled' | 'missed' | 'unresolved' | 'withdrawn';
  return path(4, ['done', reached, reached, 'current'], 'result', { key: `path.next.${result}`, ...(oath.terminalAt ? { time: at(oath.terminalAt) } : {}) }, null, result);
}
