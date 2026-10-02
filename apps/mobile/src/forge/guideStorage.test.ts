import { createGuideStorage } from './guideStorage';
const accountId = '10000000-0000-4000-8000-00000000000a';
const otherAccount = '10000000-0000-4000-8000-00000000000b';
function memoryStore() {
  const items = new Map<string, string>();
  return {
    items,
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { items.set(key, value); }),
  };
}

test('an unseen guide reads false, and marking it seen persists per account', async () => {
  const store = memoryStore();
  const storage = createGuideStorage(store);
  await expect(storage.read(accountId)).resolves.toBe(false);
  await storage.markSeen(accountId);
  expect(store.items.get(`oathforge.forge-guide.v1.${accountId}`)).toBe('seen');
  await expect(storage.read(accountId)).resolves.toBe(true);
  await expect(storage.read(otherAccount)).resolves.toBe(false);
});

test('uses device-only secure storage options', async () => {
  const store = memoryStore();
  await createGuideStorage(store).markSeen(accountId);
  expect(store.setItemAsync).toHaveBeenCalledWith(`oathforge.forge-guide.v1.${accountId}`, 'seen', expect.objectContaining({ keychainService: 'oathforge.forge-guide', requireAuthentication: false }));
});

test('a read failure or an unexpected value means not seen', async () => {
  const store = memoryStore();
  store.getItemAsync.mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(createGuideStorage(store).read(accountId)).resolves.toBe(false);
  store.items.set(`oathforge.forge-guide.v1.${accountId}`, 'true');
  await expect(createGuideStorage(store).read(accountId)).resolves.toBe(false);
});

test('a write failure resolves without throwing', async () => {
  const store = memoryStore();
  store.setItemAsync.mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(createGuideStorage(store).markSeen(accountId)).resolves.toBeUndefined();
  await expect(createGuideStorage(store).read(accountId)).resolves.toBe(false);
});

test('an invalid account never builds a key', async () => {
  const store = memoryStore();
  const storage = createGuideStorage(store);
  for (const invalid of ['', 'not-an-account', accountId.toUpperCase(), `${accountId}.x`]) {
    await expect(storage.read(invalid)).resolves.toBe(false);
    await expect(storage.markSeen(invalid)).resolves.toBeUndefined();
  }
  expect(store.getItemAsync).not.toHaveBeenCalled();
  expect(store.setItemAsync).not.toHaveBeenCalled();
});

test('a named guide keeps its own key and leaves the forge guide alone', async () => {
  const store = memoryStore();
  const rules = createGuideStorage(store, 'oath-rules-guide');
  await rules.markSeen(accountId);
  expect(store.items.get(`oathforge.oath-rules-guide.v1.${accountId}`)).toBe('seen');
  await expect(createGuideStorage(store).read(accountId)).resolves.toBe(false);
  expect(store.setItemAsync).toHaveBeenCalledWith(expect.any(String), 'seen', expect.objectContaining({ keychainService: 'oathforge.oath-rules-guide' }));
});

// MVP-22-E2.4: the first proof bark keeps its own flag.
test('the proof guide keeps its own key apart from the other guides', async () => {
  const store = memoryStore();
  await createGuideStorage(store, 'proof-guide').markSeen(accountId);
  expect(store.items.get(`oathforge.proof-guide.v1.${accountId}`)).toBe('seen');
  await expect(createGuideStorage(store).read(accountId)).resolves.toBe(false);
  await expect(createGuideStorage(store, 'oath-rules-guide').read(accountId)).resolves.toBe(false);
  await expect(createGuideStorage(store, 'proof-guide').read(accountId)).resolves.toBe(true);
});
