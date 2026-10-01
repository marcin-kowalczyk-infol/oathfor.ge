import { Directory, File, Paths } from 'expo-file-system';
import { isUuid } from '../api/oathSchema';

/** The account and character a copy belongs to. Each has its own folder, so a sweep never touches another owner. */
export type ProofOwner = { accountId: string; characterId: string };
/** Copies of normalized proof images that survive restarts until the server answers decisively or the OS purges the cache. */
export type ProofFiles = {
  copy(owner: ProofOwner, source: string, fileName: string): Promise<{ kind: 'success' | 'too_large' | 'unavailable' }>;
  open(owner: ProofOwner, fileName: string): Promise<{ kind: 'success'; file: File } | { kind: 'missing' | 'unavailable' }>;
  remove(owner: ProofOwner, fileName: string): Promise<{ kind: 'success' | 'unavailable' }>;
  /** Deletes every copy of the owner except `keep`, or all of them when `keep` is null. */
  sweep(owner: ProofOwner, keep: string | null): Promise<{ kind: 'success' | 'unavailable' }>;
};
/** The API refuses a larger image (10 MiB), so it is never copied or sent. */
export const MAX_PROOF_BYTES = 10 * 1024 * 1024;
// Only `<submissionId>.jpg` names a copy, so no caller value can reach another path.
const copyName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;
const validOwner = (owner: ProofOwner) => !!owner && isUuid(owner.accountId) && isUuid(owner.characterId);
// The cache directory is excluded from iCloud, Finder and Android Auto Backup. Raw proof must not be backed up
// (first-loop retention schedule). The OS may purge it, which the controller reports as a missing copy.
const folder = (owner: ProofOwner) => new Directory(Paths.cache, 'proofs', owner.accountId, owner.characterId);
const unavailable = { kind: 'unavailable' as const };
function discard(file: File | undefined) { try { if (file?.exists) file.delete(); } catch { /* Best effort only. */ } }
const baseName = (uri: string) => uri.replace(/\/+$/, '').split('/').pop();

export const cacheProofFiles: ProofFiles = {
  // The source is the normalized image without EXIF. The original capture never reaches this folder.
  async copy(owner, source, fileName) {
    if (!validOwner(owner) || !copyName.test(fileName) || typeof source !== 'string' || !source.startsWith('file:///')) return unavailable;
    let target: File | undefined;
    try {
      const from = new File(source);
      if (!from.exists) return unavailable;
      if (from.size > MAX_PROOF_BYTES) return { kind: 'too_large' };
      const directory = folder(owner);
      directory.create({ intermediates: true, idempotent: true });
      target = new File(directory, fileName);
      await from.copy(target, { overwrite: true });
      if (!target.exists || !(target.size > 0)) { discard(target); return unavailable; }
      return { kind: 'success' };
    } catch { discard(target); return unavailable; }
  },
  async open(owner, fileName) {
    if (!validOwner(owner) || !copyName.test(fileName)) return unavailable;
    try {
      const file = new File(folder(owner), fileName);
      return file.exists && file.size > 0 ? { kind: 'success', file } : { kind: 'missing' };
    } catch { return unavailable; }
  },
  async remove(owner, fileName) {
    if (!validOwner(owner) || !copyName.test(fileName)) return unavailable;
    try {
      const file = new File(folder(owner), fileName);
      if (file.exists) file.delete();
      return { kind: 'success' };
    } catch { return unavailable; }
  },
  async sweep(owner, keep) {
    if (!validOwner(owner) || (keep !== null && !copyName.test(keep))) return unavailable;
    try {
      const directory = folder(owner);
      if (!directory.exists) return { kind: 'success' };
      for (const entry of directory.list()) if (baseName(entry.uri) !== keep) entry.delete();
      return { kind: 'success' };
    } catch { return unavailable; }
  },
};
