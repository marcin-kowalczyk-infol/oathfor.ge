import { createDummy } from './runtime';
const token = 'A'.repeat(43);
async function preview(dummy: ReturnType<typeof createDummy>) {
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
