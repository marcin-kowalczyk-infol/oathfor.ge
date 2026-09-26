import { createDummy } from './runtime';
const token = 'A'.repeat(43);
async function character(dummy: ReturnType<typeof createDummy>) {
  if (dummy.state.activeCharacterId) return;
  const created = await dummy.runtime().characterApi.create(token, { requestId: '40000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'dummy_braid', form: 'feminine' });
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
  expect(await api.list(token)).toMatchObject({ kind: 'success', value: { characters: [], activeCharacterId: null, limit: 3, presets: ['dummy_braid', 'dummy_cropped', 'dummy_curly', 'dummy_tied'] } });
  expect(await dummy.runtime().oathApi.list(token, { view: 'today' })).toEqual({ kind: 'oath_error', code: 'character_required' });
  const input = { requestId: '40000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'dummy_braid', form: 'feminine' as const };
  const first = await api.create(token, input);
  expect(first).toMatchObject({ kind: 'success', created: true, value: { character: { id: '30000000-0000-4000-8000-000000000001', name: 'Mira' }, activeCharacterId: '30000000-0000-4000-8000-000000000001' } });
  expect(await api.create(token, input)).toMatchObject({ kind: 'success', created: false });
  expect(await api.create(token, { ...input, name: 'Bor' })).toEqual({ kind: 'character_error', code: 'idempotency_conflict' });
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
});
