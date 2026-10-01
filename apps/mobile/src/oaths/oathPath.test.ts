import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Oath, OathState } from '../api/oathSchema';
import { oathPath, proofScreenSituation } from './oathPath';

const id = '20000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-000000000001';
const received = { submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo' as const, revision: 1, receivedAt: '2026-10-24T10:00:00Z', assessment: 'queued' as const };
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog)); snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  return { id, characterId, snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof: null, ...patch };
}
const terminal = (state: OathState) => oath({ state, terminalAt: '2026-10-25T01:00:00Z', proof: received });
const D = Date.parse('2026-10-25T00:30:00Z'), S = Date.parse('2026-10-25T00:45:00Z'), MIN = 60000;
// 2026-10-25 ends summer time in Warsaw at 01:00Z, so 02:00 to 02:59 local happens twice. The offset tells them apart.
const warsaw = (local: string, offset: string) => ({ local, timezone: 'Europe/Warsaw', offset });

test.each([
  ['scheduled', oath({ state: 'scheduled', activatedAt: null }), 1, ['done', 'future', 'future', 'future'], 'waiting', 'path.next.scheduled', warsaw('2026-10-24T02:00:00', '+02:00'), null, 'scheduled'],
  ['active', oath(), 2, ['done', 'current', 'future', 'future'], null, 'path.next.active', warsaw('2026-10-25T02:30:00', '+02:00'), 'submitProof', 'active'],
  ['proof_pending', oath({ state: 'proof_pending', proof: received }), 3, ['done', 'done', 'current', 'future'], 'assessing', 'path.next.assessing', undefined, null, 'assessing'],
  ['needs_more_evidence', oath({ state: 'needs_more_evidence', proof: received }), 3, ['done', 'done', 'current', 'future'], 'needsMore', 'path.next.needsMore', undefined, null, null],
  ['review_pending', oath({ state: 'review_pending', proof: received, review: { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' } }), 3, ['done', 'done', 'current', 'future'], 'review', 'path.next.review', warsaw('2026-10-28T01:45:01', '+01:00'), null, 'review'],
  ['review_pending without a proof', oath({ state: 'review_pending', reason: 'service_availability_unknown', review: { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' } }), 3, ['done', 'skipped', 'current', 'future'], 'review', 'path.next.review', warsaw('2026-10-28T01:45:01', '+01:00'), null, 'review'],
  ['fulfilled', terminal('fulfilled'), 4, ['done', 'done', 'done', 'current'], 'result', 'path.next.fulfilled', warsaw('2026-10-25T02:00:00', '+01:00'), null, 'fulfilled'],
  ['missed', terminal('missed'), 4, ['done', 'done', 'done', 'current'], 'result', 'path.next.missed', warsaw('2026-10-25T02:00:00', '+01:00'), null, 'missed'],
  ['unresolved', terminal('unresolved'), 4, ['done', 'done', 'done', 'current'], 'result', 'path.next.unresolved', warsaw('2026-10-25T02:00:00', '+01:00'), null, 'unresolved'],
  ['withdrawn', terminal('withdrawn'), 4, ['done', 'done', 'done', 'current'], 'result', 'path.next.withdrawn', warsaw('2026-10-25T02:00:00', '+01:00'), null, 'withdrawn'],
] as const)('%s maps to its step, badge, line, action and situation', (_, value, step, steps, badge, key, time, action, zaromir) => {
  expect(oathPath(value, 'none', false, null)).toEqual({ step, steps, badge, next: time ? { key, time } : { key }, action, zaromir });
});

test('an interrupted upload on an active Oath asks to send again, a running send asks nothing', () => {
  expect(oathPath(oath(), 'waiting', false, null)).toEqual({ step: 2, steps: ['done', 'current', 'future', 'future'], badge: 'interrupted', next: { key: 'path.next.interrupted' }, action: 'sendAgain', zaromir: 'interrupted' });
  expect(oathPath(oath(), 'sending', false, null)).toMatchObject({ badge: null, action: null, zaromir: null });
  expect(oathPath(oath(), 'deleting', false, null)).toMatchObject({ badge: null, action: null, zaromir: null });
});

test('a refused or failed proof leaves no record, so the Oath reads as without one', () => {
  expect(oathPath(oath(), 'refused', false, null)).toEqual(oathPath(oath(), 'none', false, null));
  expect(oathPath(oath(), 'failed', false, null)).toEqual(oathPath(oath(), 'none', false, null));
});

test('a waiting record on an Oath the server moved on shows the server state', () => {
  expect(oathPath(terminal('missed'), 'waiting', false, null)).toEqual(oathPath(terminal('missed'), 'none', false, null));
});

test('steps never reached are skipped, not done', () => {
  expect(oathPath(oath({ state: 'missed', terminalAt: '2026-10-25T01:00:00Z' }), 'none', false, null).steps).toEqual(['done', 'skipped', 'skipped', 'current']);
  expect(oathPath(oath({ state: 'withdrawn', activatedAt: null, terminalAt: '2026-10-24T01:00:00Z', proof: received }), 'none', false, null).steps).toEqual(['done', 'skipped', 'skipped', 'current']);
});

test('Żaromir is silent while paused, and while the pause is unknown except before and during the workout', () => {
  expect(oathPath(oath(), 'none', true, null).zaromir).toBeNull();
  expect(oathPath(oath(), 'none', null, null).zaromir).toBe('active');
  expect(oathPath(oath({ state: 'scheduled', activatedAt: null }), 'none', null, null).zaromir).toBe('scheduled');
  expect(oathPath(oath({ state: 'proof_pending', proof: received }), 'none', null, null).zaromir).toBeNull();
  expect(oathPath(terminal('fulfilled'), 'none', null, null).zaromir).toBeNull();
});

test('Żaromir urges only in the last hour, between the deadline and the cutoff, and for an interrupted upload before the cutoff', () => {
  expect(oathPath(oath(), 'none', false, D - 60 * MIN)).toMatchObject({ zaromir: 'active', next: { key: 'path.next.active' } });
  expect(oathPath(oath(), 'none', false, D - 59 * MIN)).toMatchObject({ zaromir: 'activeSoon', next: { key: 'path.next.activeSoon', time: warsaw('2026-10-25T02:30:00', '+02:00') } });
  expect(oathPath(oath(), 'none', false, D).zaromir).toBe('activeSoon');
  expect(oathPath(oath(), 'none', false, D + MIN)).toMatchObject({ zaromir: 'cutoff', next: { key: 'path.next.cutoff', time: warsaw('2026-10-25T02:45:00', '+02:00') } });
  expect(oathPath(oath(), 'none', false, S).zaromir).toBe('cutoff');
  expect(oathPath(oath(), 'none', false, S + MIN).zaromir).toBeNull();
  expect(oathPath(oath(), 'waiting', false, S).zaromir).toBe('interrupted');
});

// Review finding, 2026-10-01: after the cutoff nothing asks for proof. The server settles the state at its next answer.
test('after the cutoff the line says the window has closed and no action is offered', () => {
  expect(oathPath(oath(), 'none', false, S + MIN)).toEqual({ step: 2, steps: ['done', 'current', 'future', 'future'], badge: null, next: { key: 'path.next.closed' }, action: null, zaromir: null });
  expect(oathPath(oath(), 'waiting', false, S + MIN)).toMatchObject({ badge: 'interrupted', next: { key: 'path.next.closed' }, action: null, zaromir: null });
  expect(oathPath(oath(), 'waiting', false, S)).toMatchObject({ next: { key: 'path.next.interrupted' }, action: 'sendAgain' });
});

test('a deadline in the repeated autumn hour keeps its own offset for the deadline and the cutoff', () => {
  const second = oath({ snapshot: { ...oath().snapshot, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+01:00', explicitOffset: true, utc: '2026-10-25T01:30:00Z', receiptCutoff: '2026-10-25T01:45:00Z' } } });
  expect(oathPath(second, 'none', false, null).next.time).toEqual(warsaw('2026-10-25T02:30:00', '+01:00'));
  expect(oathPath(second, 'none', false, Date.parse('2026-10-25T01:31:00Z')).next).toEqual({ key: 'path.next.cutoff', time: warsaw('2026-10-25T02:45:00', '+01:00') });
});

test('the proof screen keeps the conditional cutoff line between the deadline and the cutoff', () => {
  expect(proofScreenSituation(oathPath(oath(), 'none', false, D - 59 * MIN))).toBe('proofScreen');
  expect(proofScreenSituation(oathPath(oath(), 'none', false, D + MIN))).toBe('cutoff');
  expect(proofScreenSituation(oathPath(oath(), 'none', true, D + MIN))).toBeNull();
});
