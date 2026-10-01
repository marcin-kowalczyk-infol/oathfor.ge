import type { ProofController } from './proofController';

// Submissions already resumed by this process. A reload of the same record, for example after a character refresh
// that a proof error asked for, must not resend it in a loop. The player's own "Send again" is not limited.
const resumed = new Set<string>();

/**
 * Sends a stored proof again when the controller finishes loading an owner's record, for example after a restart,
 * a new session or a character switch. Each submission is resumed at most once per process. Later retries are the player's.
 */
export function resumeOnLoad(controller: Pick<ProofController, 'getState' | 'subscribe' | 'recover'>): () => void {
  let loaded = false;
  function check() {
    const state = controller.getState();
    if (state.kind !== 'ready') { loaded = false; return; }
    if (loaded) return;
    loaded = true;
    if (state.pending && !state.busy && !resumed.has(state.pending.submissionId)) {
      resumed.add(state.pending.submissionId);
      void controller.recover();
    }
  }
  const unsubscribe = controller.subscribe(check);
  check();
  return unsubscribe;
}
