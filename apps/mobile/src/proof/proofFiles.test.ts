import { cacheProofFiles, MAX_PROOF_BYTES } from './proofFiles';

jest.mock('expo-file-system', () => {
  // In-memory stand-in for the native file system: URI to bytes, with optional reported sizes.
  const disk = new Map<string, string>();
  const sizes = new Map<string, number>();
  const directories: { uri: string; create: jest.Mock }[] = [];
  const join = (parts: unknown[]) => {
    const [, scheme, path] = /^([a-z]+:\/\/)(.*)$/.exec(parts.map(part => typeof part === 'string' ? part : (part as { uri: string }).uri).join('/'))!;
    return scheme + path.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  };
  class Directory {
    uri: string;
    create = jest.fn();
    constructor(...parts: unknown[]) { this.uri = join(parts); directories.push(this); }
    get exists() { return [...disk.keys()].some(uri => uri.startsWith(`${this.uri}/`)); }
    list() {
      const children = new Set([...disk.keys()].filter(uri => uri.startsWith(`${this.uri}/`)).map(uri => uri.slice(this.uri.length + 1).split('/')[0]));
      return [...children].map(child => [...disk.keys()].includes(`${this.uri}/${child}`) ? new File(this.uri, child) : new Directory(this.uri, child));
    }
    delete() { for (const uri of [...disk.keys()]) if (uri.startsWith(`${this.uri}/`)) disk.delete(uri); }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return disk.has(this.uri); }
    get size() { return sizes.get(this.uri) ?? disk.get(this.uri)?.length ?? 0; }
    copy = jest.fn(async (target: File) => {
      const bytes = disk.get(this.uri); if (bytes === undefined) throw new Error('DUMMY missing');
      // An interrupted native copy leaves part of the bytes behind.
      if (this.uri.endsWith('interrupted.jpg')) { disk.set(target.uri, bytes.slice(0, 2)); throw new Error('DUMMY interrupted'); }
      disk.set(target.uri, bytes);
    });
    delete = jest.fn(() => { if (!disk.delete(this.uri)) throw new Error('DUMMY missing'); });
  }
  return { File, Directory, Paths: { get cache() { return new Directory('file:///cache/'); }, get document() { return new Directory('file:///documents/'); } },
    mockDisk: disk, mockSizes: sizes, mockDirectories: directories };
});
const { mockDisk: disk, mockSizes: sizes, mockDirectories: directories } = jest.requireMock('expo-file-system') as
  { mockDisk: Map<string, string>; mockSizes: Map<string, number>; mockDirectories: { uri: string; create: jest.Mock }[] };
const accountId = '10000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-00000000000a';
const otherCharacter = '30000000-0000-4000-8000-00000000000b';
const owner = { accountId, characterId };
const submissionId = '4a0b0c0d-0000-4000-8000-00000000000f';
const secondId = '4a0b0c0d-0000-4000-8000-0000000000a0';
const name = `${submissionId}.jpg`;
const source = 'file:///cache/ImageManipulator/normalized.jpg';
const folder = `file:///cache/proofs/${accountId}/${characterId}`;
const target = `${folder}/${name}`;
const stored = () => [...disk.keys()].filter(uri => uri.startsWith('file:///cache/proofs/') || uri.startsWith('file:///documents/')).sort();
beforeEach(() => { disk.clear(); sizes.clear(); directories.length = 0; disk.set(source, 'JPEG-BYTES'); });

test('copies the normalized image into the owner folder in the cache directory and keeps the source', async () => {
  await expect(cacheProofFiles.copy(owner, source, name)).resolves.toEqual({ kind: 'success' });
  // The cache directory is outside iCloud, Finder and Android Auto Backup, so no raw proof backup is made.
  expect(stored()).toEqual([target]);
  expect(disk.get(target)).toBe('JPEG-BYTES');
  expect(disk.get(source)).toBe('JPEG-BYTES');
});

test('creates the owner folder with intermediates and without failing when it exists', async () => {
  await cacheProofFiles.copy(owner, source, name);
  const created = directories.filter(directory => directory.uri === folder);
  expect(created.flatMap(directory => directory.create.mock.calls)).toEqual([[{ intermediates: true, idempotent: true }]]);
});

test('an image above the API limit is refused before copying', async () => {
  expect(MAX_PROOF_BYTES).toBe(10 * 1024 * 1024);
  sizes.set(source, MAX_PROOF_BYTES + 1);
  await expect(cacheProofFiles.copy(owner, source, name)).resolves.toEqual({ kind: 'too_large' });
  expect(stored()).toEqual([]);
  sizes.set(source, MAX_PROOF_BYTES);
  await expect(cacheProofFiles.copy(owner, source, name)).resolves.toEqual({ kind: 'success' });
});

test.each([
  ['a missing source', owner, 'file:///cache/gone.jpg', name],
  ['a remote source', owner, 'https://example.test/x.jpg', name],
  ['a content URI', owner, 'content://media/external/images/1', name],
  ['a path in the name', owner, source, `../${name}`],
  ['another extension', owner, source, `${submissionId}.heic`],
  ['a name without a submission', owner, source, 'IMG_0001.jpg'],
  ['a malformed account', { accountId: '..', characterId }, source, name],
  ['a malformed character', { accountId, characterId: 'hero' }, source, name],
])('refuses %s without leaving a copy', async (_label, who, from, fileName) => {
  await expect(cacheProofFiles.copy(who, from, fileName)).resolves.toEqual({ kind: 'unavailable' });
  expect(stored()).toEqual([]);
});

test('an empty copy is removed and reported', async () => {
  disk.set(source, '');
  await expect(cacheProofFiles.copy(owner, source, name)).resolves.toEqual({ kind: 'unavailable' });
  expect(disk.has(target)).toBe(false);
});

test('a copy that fails midway removes the partial file', async () => {
  disk.set('file:///cache/interrupted.jpg', 'JPEG-BYTES');
  await expect(cacheProofFiles.copy(owner, 'file:///cache/interrupted.jpg', name)).resolves.toEqual({ kind: 'unavailable' });
  expect(disk.has(target)).toBe(false);
});

test('opens only the owner copy as a File named after the submission', async () => {
  disk.set(target, 'JPEG-BYTES');
  await expect(cacheProofFiles.open(owner, name)).resolves.toMatchObject({ kind: 'success', file: { uri: target } });
  await expect(cacheProofFiles.open({ accountId, characterId: otherCharacter }, name)).resolves.toEqual({ kind: 'missing' });
  await expect(cacheProofFiles.open(owner, `${secondId}.jpg`)).resolves.toEqual({ kind: 'missing' });
  disk.set(target, '');
  await expect(cacheProofFiles.open(owner, name)).resolves.toEqual({ kind: 'missing' });
  await expect(cacheProofFiles.open(owner, '../secrets.jpg')).resolves.toEqual({ kind: 'unavailable' });
});

test('removes the owner copy, treats an absent copy as removed and refuses foreign names', async () => {
  const otherCopy = `file:///cache/proofs/${accountId}/${otherCharacter}/${name}`;
  disk.set(target, 'JPEG-BYTES'); disk.set(otherCopy, 'OTHER');
  await expect(cacheProofFiles.remove(owner, name)).resolves.toEqual({ kind: 'success' });
  expect(stored()).toEqual([otherCopy]);
  await expect(cacheProofFiles.remove(owner, name)).resolves.toEqual({ kind: 'success' });
  await expect(cacheProofFiles.remove(owner, '../secrets.jpg')).resolves.toEqual({ kind: 'unavailable' });
  expect(stored()).toEqual([otherCopy]);
});

test('a sweep deletes every owner copy except the kept one and leaves other characters alone', async () => {
  const otherCopy = `file:///cache/proofs/${accountId}/${otherCharacter}/${secondId}.jpg`;
  disk.set(target, 'KEEP'); disk.set(`${folder}/${secondId}.jpg`, 'ORPHAN'); disk.set(`${folder}/stray.tmp`, 'STRAY'); disk.set(`${folder}/nested/x.jpg`, 'NESTED');
  disk.set(otherCopy, 'OTHER');
  await expect(cacheProofFiles.sweep(owner, name)).resolves.toEqual({ kind: 'success' });
  expect(stored()).toEqual([otherCopy, target].sort());
  await expect(cacheProofFiles.sweep(owner, null)).resolves.toEqual({ kind: 'success' });
  expect(stored()).toEqual([otherCopy]);
});

test('a sweep of a missing folder succeeds and malformed input is refused', async () => {
  await expect(cacheProofFiles.sweep(owner, null)).resolves.toEqual({ kind: 'success' });
  await expect(cacheProofFiles.sweep({ accountId, characterId: '..' }, null)).resolves.toEqual({ kind: 'unavailable' });
  disk.set(target, 'KEEP');
  await expect(cacheProofFiles.sweep(owner, '../x.jpg')).resolves.toEqual({ kind: 'unavailable' });
  expect(stored()).toEqual([target]);
});
