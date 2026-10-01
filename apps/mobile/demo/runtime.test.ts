import { createDummy } from './runtime';
import { cacheProofFiles } from '../src/proof/proofFiles';
const token = 'A'.repeat(43);
async function character(dummy: ReturnType<typeof createDummy>) {
  if (dummy.state.activeCharacterId) return;
  const created = await dummy.runtime().characterApi.create(token, { requestId: '40000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'starter_01', build: 'thin', form: 'feminine' });
  if (created.kind !== 'success') throw new Error('Character creation failed');
}
async function preview(dummy: ReturnType<typeof createDummy>) {
  await character(dummy);
  const deadline = new Date(dummy.state.now + 86400000).toISOString().slice(0, 19);
  const result = await dummy.runtime().oathApi.preview(token, { activity: 'running', activation: { mode: 'now' }, deadline: { local: deadline, timezone: 'UTC' } });
  if (result.kind !== 'success') throw new Error('Preview failed');
  return result.value.preview.id;
}
test('empty and returning fixtures reuse bilingual immutable rule content', async () => {
  const empty = createDummy('pl', true, false);
  expect(empty.state.oaths).toHaveLength(0);
  const returning = createDummy('en', true);
  expect(returning.state.oaths).toHaveLength(25);
  const api = returning.runtime().oathApi;
  const history = await api.list(token, { view: 'history', limit: 20 });
  expect(history.kind).toBe('success');
  if (history.kind === 'success') expect(history.value.nextCursor).toBe('page_20');
  const owned = returning.state.oaths.filter(oath => oath.characterId === returning.state.activeCharacterId);
  const [today, historyTail] = await Promise.all([api.list(token, { view: 'today', limit: 1 }), api.list(token, { view: 'history', limit: 20, cursor: 'page_20' })]);
  expect(today).toMatchObject({ kind: 'success', value: { total: owned.filter(oath => oath.terminalAt === null).length } });
  expect(historyTail).toMatchObject({ kind: 'success', value: { nextCursor: null, total: owned.filter(oath => oath.terminalAt !== null).length } });
  const id = await preview(empty);
  const rules = empty.state.previews.get(id)!.snapshot;
  expect(rules.copy.pl.activity).toBeTruthy();
  expect(rules.copy.en.activity).toBeTruthy();
  expect(rules.evidence.alternatives).toEqual(['photo', 'activity_record']);
});
test('lost reply survives interface restart, offline and session expiry without a duplicate', async () => {
  const dummy = createDummy('en', true, false);
  const input = { previewId: await preview(dummy), requestId: '30000000-0000-4000-8000-000000000001', accepted: true as const };
  dummy.state.loseNext = true;
  expect((await dummy.runtime().oathApi.confirm(token, input)).kind).toBe('unavailable');
  expect(dummy.state.oaths).toHaveLength(1);
  dummy.state.offline = true;
  expect((await dummy.runtime().oathApi.confirm(token, input)).kind).toBe('unavailable');
  dummy.state.offline = false;
  dummy.state.expired = true;
  expect((await dummy.runtime().oathApi.confirm(token, input)).kind).toBe('reauthenticate');
  dummy.state.expired = false;
  expect((await dummy.runtime().oathApi.confirm(token, input)).kind).toBe('success');
  expect(dummy.state.oaths).toHaveLength(1);
});
test('reusing an acceptance request for another preview is a conflict', async () => {
  const dummy = createDummy('en', true, false);
  const api = dummy.runtime().oathApi;
  const requestId = '30000000-0000-4000-8000-000000000001';
  await api.confirm(token, { previewId: await preview(dummy), requestId, accepted: true });
  expect(await api.confirm(token, { previewId: await preview(dummy), requestId, accepted: true })).toEqual({ kind: 'oath_error', code: 'idempotency_conflict' });
  expect(dummy.state.oaths).toHaveLength(1);
});

test('DUMMY characters: empty accounts start without one, creation replays and switching changes Oath ownership', async () => {
  const dummy = createDummy('en', true, false);
  const api = dummy.runtime().characterApi;
  expect(await api.list(token)).toMatchObject({ kind: 'success', value: { characters: [], activeCharacterId: null, limit: 3, presets: ['starter_01', 'starter_02', 'starter_03', 'starter_04', 'starter_05', 'starter_06'] } });
  expect(await dummy.runtime().oathApi.list(token, { view: 'today' })).toEqual({ kind: 'oath_error', code: 'character_required' });
  const input = { requestId: '40000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'starter_01', build: 'heavy' as const, form: 'feminine' as const };
  const first = await api.create(token, input);
  expect(first).toMatchObject({ kind: 'success', created: true, value: { character: { id: '30000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'starter_01', build: 'heavy' }, activeCharacterId: '30000000-0000-4000-8000-000000000001' } });
  expect(await api.create(token, input)).toMatchObject({ kind: 'success', created: false, value: { character: { build: 'heavy' } } });
  expect(await api.create(token, { ...input, name: 'Bor' })).toEqual({ kind: 'character_error', code: 'idempotency_conflict' });
  expect(await api.create(token, { ...input, build: 'thin' })).toEqual({ kind: 'character_error', code: 'idempotency_conflict' });
  expect(await api.create(token, { ...input, build: 'broad' as never })).toEqual({ kind: 'character_error', code: 'invalid_request' });
  const fresh = { ...input, requestId: '40000000-0000-4000-8000-000000000009' };
  expect(await api.create(token, { ...fresh, presetId: 'dummy_braid' })).toEqual({ kind: 'character_error', code: 'invalid_preset' });
  expect(await api.create(token, { ...fresh, build: 'broad' as never })).toEqual({ kind: 'character_error', code: 'invalid_request' });
  expect(dummy.state.characters).toHaveLength(1);
  await preview(dummy);
  await api.create(token, { ...input, requestId: '40000000-0000-4000-8000-000000000002', name: 'Bor' });
  expect(dummy.state.activeCharacterId).toBe('30000000-0000-4000-8000-000000000002');
  const today = await dummy.runtime().oathApi.list(token, { view: 'today' });
  expect(today).toMatchObject({ kind: 'success', value: { items: [], characterId: '30000000-0000-4000-8000-000000000002' } });
  expect(await api.activate(token, '30000000-0000-4000-8000-000000000001')).toMatchObject({ kind: 'success', value: { activeCharacterId: '30000000-0000-4000-8000-000000000001' } });
  expect(await api.activate(token, '30000000-0000-4000-8000-000000000009')).toEqual({ kind: 'character_error', code: 'not_found' });
});

test('the returning fixture already has an active character owning its Oaths', async () => {
  const dummy = createDummy('pl', true);
  expect(dummy.state.activeCharacterId).toBe('30000000-0000-4000-8000-000000000001');
  expect(dummy.state.oaths.every(oath => oath.characterId === dummy.state.activeCharacterId)).toBe(true);
  expect(dummy.state.characters.map(({ name, presetId, build }) => ({ name, presetId, build }))).toEqual([{ name: 'Radomir', presetId: 'starter_02', build: 'thin' }, { name: 'Wiesna', presetId: 'starter_03', build: 'heavy' }]);
  const api = dummy.runtime();
  await api.characterApi.activate(token, '30000000-0000-4000-8000-000000000002');
  expect(await api.oathApi.list(token, { view: 'today' })).toMatchObject({ kind: 'success', value: { items: [], characterId: '30000000-0000-4000-8000-000000000002' } });
  const created = await api.characterApi.create(token, { requestId: '40000000-0000-4000-8000-000000000003', name: 'Wit', presetId: 'starter_04', build: 'thin', form: 'neutral' });
  expect(created).toMatchObject({ kind: 'success', value: { character: { id: '30000000-0000-4000-8000-000000000003' } } });
});

test('each scenario starts without the room guide flag, while an interface restart keeps it', async () => {
  const dummy = createDummy('pl', true, false);
  const account = '10000000-0000-4000-8000-000000000001';
  expect(await dummy.runtime().guideStorage.read(account)).toBe(false);
  await dummy.runtime().guideStorage.markSeen(account);
  expect(await dummy.runtime().guideStorage.read(account)).toBe(true);
  expect(await createDummy('pl', true, false).runtime().guideStorage.read(account)).toBe(false);
});
test('the offline control reports a reconnect only when it goes back online', () => {
  const dummy = createDummy('en', true);
  const reconnect = jest.fn();
  const stop = dummy.runtime().network.onReconnect(reconnect);
  dummy.setOffline(false);
  expect(reconnect).not.toHaveBeenCalled();
  dummy.setOffline(true);
  expect(dummy.state.offline).toBe(true);
  dummy.setOffline(false);
  expect(reconnect).toHaveBeenCalledTimes(1);
  stop();
  dummy.setOffline(true); dummy.setOffline(false);
  expect(reconnect).toHaveBeenCalledTimes(1);
});

// Owner decision 2026-09-30: the demo starts in the cinematic style, including onboarding.
test('the DUMMY art style starts cinematic, survives an interface restart and a new scenario resets it', () => {
  for (const [completed, populated] of [[false, false], [true, false], [true, true]] as const) expect(createDummy('pl', completed, populated).runtime().artStyle.read()).toBe('cinematic');
  const dummy = createDummy('pl', true);
  dummy.runtime().artStyle.write('current');
  // An interface restart builds a new runtime over the same DUMMY state.
  expect(dummy.runtime().artStyle.read()).toBe('current');
  expect(createDummy('pl', true).runtime().artStyle.read()).toBe('cinematic');
});

const proofFile = (submissionId: string) => ({ uri: `file:///cache/proofs/${submissionId}.jpg` }) as never;
test('DUMMY proof: a receipt turns the active Oath proof_pending, a replay returns the same receipt and a lost reply still commits', async () => {
  const dummy = createDummy('en', true);
  const api = dummy.runtime().proofApi;
  const active = dummy.state.oaths.find(oath => oath.state === 'active')!;
  const first = '40000000-0000-4000-8000-000000000001';
  dummy.state.offline = true;
  expect(await api.submit(token, active.id, { submissionId: first, mode: 'photo', file: proofFile(first) })).toEqual({ kind: 'unavailable', retry: 'request' });
  expect(active.state).toBe('active');
  dummy.state.offline = false;
  dummy.state.loseNextProof = true;
  expect(await api.submit(token, active.id, { submissionId: first, mode: 'photo', file: proofFile(first) })).toEqual({ kind: 'unavailable', retry: 'request' });
  expect(dummy.state.loseNextProof).toBe(false);
  expect(active).toMatchObject({ state: 'proof_pending', proof: { submissionId: first, mode: 'photo', revision: 1, assessment: 'queued' } });
  const receivedAt = active.proof!.receivedAt;
  dummy.state.now += 60000;
  const replay = await api.submit(token, active.id, { submissionId: first, mode: 'photo', file: proofFile(first) });
  expect(replay).toMatchObject({ kind: 'success', value: { created: false, proof: { submissionId: first, receivedAt }, oath: { id: active.id, state: 'proof_pending' } } });
  const other = '40000000-0000-4000-8000-000000000002';
  expect(await api.submit(token, active.id, { submissionId: other, mode: 'activity_record', file: proofFile(other) })).toEqual({ kind: 'proof_refused', code: 'proof_already_submitted' });
  // The Oath screens see the receipt, and a pause keeps the pending case.
  expect(await dummy.runtime().oathApi.detail(token, active.id)).toMatchObject({ kind: 'success', value: { oath: { state: 'proof_pending', proof: { submissionId: first } } } });
});

test('DUMMY proof: after the cutoff the receipt is refused, a scheduled Oath is not active and a stranger Oath is not found', async () => {
  const dummy = createDummy('en', true);
  const api = dummy.runtime().proofApi;
  const id = '40000000-0000-4000-8000-000000000003';
  const scheduled = dummy.state.oaths.find(oath => oath.state === 'scheduled')!;
  expect(await api.submit(token, scheduled.id, { submissionId: id, mode: 'photo', file: proofFile(id) })).toEqual({ kind: 'proof_refused', code: 'oath_not_active', state: 'scheduled' });
  expect(await api.submit(token, '20000000-0000-4000-8000-0000000009ff', { submissionId: id, mode: 'photo', file: proofFile(id) })).toEqual({ kind: 'proof_error', code: 'not_found' });
  const active = dummy.state.oaths.find(oath => oath.state === 'active')!;
  dummy.state.now = Date.parse(active.snapshot.deadline.receiptCutoff) + 1000;
  expect(await api.submit(token, active.id, { submissionId: id, mode: 'photo', file: proofFile(id) })).toEqual({ kind: 'proof_refused', code: 'receipt_cutoff_passed' });
  dummy.state.expired = true;
  expect(await api.submit(token, active.id, { submissionId: id, mode: 'photo', file: proofFile(id) })).toEqual({ kind: 'reauthenticate' });
});

test('DUMMY proof record survives an interface restart, uses the real file copy and a new scenario starts empty', async () => {
  const dummy = createDummy('en', true);
  const account = '10000000-0000-4000-8000-000000000001';
  const character = dummy.state.activeCharacterId!;
  const submissionId = '40000000-0000-4000-8000-000000000004';
  const record = { version: 1 as const, accountId: account, characterId: character, oathId: dummy.state.oaths[1].id, submissionId, mode: 'photo' as const, fileName: `${submissionId}.jpg` };
  const runtime = dummy.runtime();
  expect(runtime.proofFiles).toBe(cacheProofFiles);
  expect(await runtime.proofStorage.write(account, character, record)).toEqual({ kind: 'success' });
  expect(await dummy.runtime().proofStorage.read(account, character)).toEqual({ kind: 'success', value: record });
  expect(await runtime.proofStorage.write(account, character, { ...record, characterId: '30000000-0000-4000-8000-000000000002' })).toEqual({ kind: 'unavailable' });
  expect(await createDummy('en', true).runtime().proofStorage.read(account, character)).toEqual({ kind: 'success', value: null });
});
