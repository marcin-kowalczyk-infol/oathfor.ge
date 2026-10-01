import type { Oath, OathState } from '../api/oathSchema';
import { wallTimeIn } from './compactStoredTime';
import type { DeviceProof } from './deviceProof';

export type StepStatus = 'done' | 'current' | 'future' | 'skipped';
export type PathBadge = 'waiting' | 'interrupted' | 'assessing' | 'needsMore' | 'review' | 'result' | null;
/** `proofScreen`, `confirmed` and `confirmedScheduled` come from their screens, never from `oathPath`. */
export type ZaromirSituation = 'scheduled' | 'active' | 'activeSoon' | 'cutoff' | 'interrupted' | 'assessing' | 'review'
  | 'fulfilled' | 'missed' | 'unresolved' | 'withdrawn' | 'confirmed' | 'confirmedScheduled' | 'proofScreen';
/** A stored wall time in the Oath's zone, unformatted. The offset tells apart the hour that repeats when summer time ends. */
export type PathTime = { local: string; timezone: string; offset: string };
export type OathPath = {
  step: 1 | 2 | 3 | 4;
  steps: [StepStatus, StepStatus, StepStatus, StepStatus];
  badge: PathBadge;
  next: { key: string; time?: PathTime };
  action: null | 'submitProof' | 'sendAgain';
  zaromir: ZaromirSituation | null;
};

const HOUR = 3600000;
/** The zone offset of an instant, from its wall time: "+01:00". */
function offsetOf(instant: string, local: string): string {
  const minutes = Math.round((Date.parse(`${local}Z`) - Date.parse(instant)) / 60000), size = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${String(Math.floor(size / 60)).padStart(2, '0')}:${String(size % 60).padStart(2, '0')}`;
}
const assessment: Partial<Record<OathState, [PathBadge, string, ZaromirSituation | null]>> = {
  proof_pending: ['assessing', 'path.next.assessing', 'assessing'],
  needs_more_evidence: ['needsMore', 'path.next.needsMore', null],
  review_pending: ['review', 'path.next.review', 'review'],
};

/**
 * Where an Oath stands on the four steps (docs/product/clarity.md "Step track", decisions 1 to 8). Only server state, the device's own
 * proof record and the server clock count. `paused` null means unknown: a pause withdraws scheduled and active Oaths, so only they may hear Żaromir.
 */
export function oathPath(oath: Oath, device: DeviceProof, paused: boolean | null, now: number | null): OathPath {
  const zone = oath.snapshot.deadline.timezone;
  const at = (instant: string): PathTime => { const local = wallTimeIn(instant, zone); return { local, timezone: zone, offset: offsetOf(instant, local) }; };
  const own = ({ local, timezone, offset }: PathTime): PathTime => ({ local, timezone, offset });
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
    // After the cutoff nothing asks for proof. The server settles the state at its next answer, an interrupted copy keeps its badge.
    if (closed) return path(2, steps, device === 'waiting' ? 'interrupted' : null, { key: 'path.next.closed' }, null, null);
    if (device === 'waiting') return path(2, steps, 'interrupted', { key: 'path.next.interrupted' }, 'sendAgain', 'interrupted');
    const late = now !== null && now > deadline, soon = !late && now !== null && deadline - now < HOUR;
    const situation = late ? 'cutoff' : soon ? 'activeSoon' : 'active';
    // Between D and S the line names S, the moment the window for proof closes. The chip already reads elapsed.
    const next = late ? { key: 'path.next.cutoff', time: at(oath.snapshot.deadline.receiptCutoff) } : { key: soon ? 'path.next.activeSoon' : 'path.next.active', time: own(oath.snapshot.deadline) };
    return path(2, steps, null, next, 'submitProof', situation);
  }
  const pending = assessment[oath.state];
  if (pending) {
    const [badge, key, situation] = pending;
    const time = oath.state === 'review_pending' && oath.review ? { time: at(oath.review.closesAt) } : {};
    // The reconciler sends an Oath to review past S without a received proof. Its workout step never happened here.
    return path(3, ['done', oath.proof === null ? 'skipped' : 'done', 'current', 'future'], badge, { key, ...time }, null, situation);
  }
  // Terminal. Without a proof, or without a start, the workout and its assessment never happened.
  const reached: StepStatus = oath.proof === null || oath.activatedAt === null ? 'skipped' : 'done';
  const result = oath.state as 'fulfilled' | 'missed' | 'unresolved' | 'withdrawn';
  return path(4, ['done', reached, reached, 'current'], 'result', { key: `path.next.${result}`, ...(oath.terminalAt ? { time: at(oath.terminalAt) } : {}) }, null, result);
}

/** The proof screen's own lines urge nothing, so between D and S it keeps the conditional cutoff line. Silent wherever the path is. */
export function proofScreenSituation(path: OathPath): ZaromirSituation | null {
  return path.zaromir === null ? null : path.zaromir === 'cutoff' ? 'cutoff' : 'proofScreen';
}
