import type { ProofController, ProofControllerState } from './proofController';
import { resumeOnLoad } from './resumeOnLoad';

const pending = { version: 1 as const, accountId: '10000000-0000-4000-8000-000000000001', characterId: '30000000-0000-4000-8000-000000000001', oathId: '20000000-0000-4000-8000-000000000001', submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo' as const, fileName: '40000000-0000-4000-8000-000000000001.jpg' };
function fake(initial: ProofControllerState = { kind: 'idle' }) {
  let state = initial;
  const listeners = new Set<() => void>();
  const controller = { getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, recover: jest.fn(async () => {}) } as unknown as ProofController;
  return { controller, listeners, set(next: ProofControllerState) { state = next; listeners.forEach(fn => fn()); } };
}

test('a proof found when the controller loads is sent again once, a later ready state does not repeat it', () => {
  const f = fake();
  const stop = resumeOnLoad(f.controller);
  f.set({ kind: 'loading' });
  f.set({ kind: 'ready', busy: false, pending, oath: null });
  expect(f.controller.recover).toHaveBeenCalledTimes(1);
  f.set({ kind: 'ready', busy: true, pending, oath: null });
  f.set({ kind: 'ready', busy: false, pending, oath: null, error: { kind: 'unavailable', retry: 'request' } });
  expect(f.controller.recover).toHaveBeenCalledTimes(1);
  // A reload of the same proof, for example after a character refresh, does not send it again by itself.
  f.set({ kind: 'loading' });
  f.set({ kind: 'ready', busy: false, pending, oath: null });
  expect(f.controller.recover).toHaveBeenCalledTimes(1);
  // Another proof found by a later load is resumed once too.
  f.set({ kind: 'loading' });
  f.set({ kind: 'ready', busy: false, pending: { ...pending, submissionId: '40000000-0000-4000-8000-000000000002', fileName: '40000000-0000-4000-8000-000000000002.jpg' }, oath: null });
  expect(f.controller.recover).toHaveBeenCalledTimes(2);
  stop();
  expect(f.listeners.size).toBe(0);
});

test('nothing is sent without a stored proof, and a controller already loaded is checked at once', () => {
  const empty = fake();
  resumeOnLoad(empty.controller);
  empty.set({ kind: 'loading' });
  empty.set({ kind: 'ready', busy: false, pending: null, oath: null });
  expect(empty.controller.recover).not.toHaveBeenCalled();
  const loaded = fake({ kind: 'ready', busy: false, pending: { ...pending, submissionId: '40000000-0000-4000-8000-000000000003', fileName: '40000000-0000-4000-8000-000000000003.jpg' }, oath: null });
  resumeOnLoad(loaded.controller);
  expect(loaded.controller.recover).toHaveBeenCalledTimes(1);
});
