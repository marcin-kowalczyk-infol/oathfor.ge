import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { isPreviewEnvelope } from './oathSchema';

const id = '00000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-00000000000c';
const otherCharacterId = '30000000-0000-4000-8000-000000000002';
function preview() {
  const snapshot = JSON.parse(JSON.stringify(catalog)) as Record<string, any>;
  snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: null };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { preview: { id, snapshot }, characterId, serverTime: '2026-10-24T00:00:00Z' };
}
test('accepts the actual canonical bilingual policy snapshot from the server', () => {
  expect(isPreviewEnvelope(preview())).toBe(true);
});

test('preview envelopes require the canonical owning character', () => {
  const { preview: value, serverTime } = preview();
  expect(isPreviewEnvelope({ preview: value, serverTime })).toBe(false);
  expect(isPreviewEnvelope({ preview: value, characterId: characterId.toUpperCase(), serverTime })).toBe(false);
  expect(isPreviewEnvelope({ preview: value, characterId: null, serverTime })).toBe(false);
  expect(isStoredPreviewEnvelope({ preview: value, characterId, oathId: null })).toBe(true);
  expect(isStoredPreviewEnvelope({ preview: value, oathId: null })).toBe(false);
  expect(isStoredPreviewEnvelope({ preview: value, characterId: 'other', oathId: null })).toBe(false);
});

import { isOathEnvelope, isOathListEnvelope, isPauseEnvelope, isPreviewInput, isStoredPreviewEnvelope, isUuid } from './oathSchema';

function oath() {
  const value = preview();
  value.preview.snapshot.activation = { mode: 'scheduled', time: { local: '2026-10-24T20:00:00', timezone: 'UTC', offset: '+00:00', explicitOffset: false, utc: '2026-10-24T20:00:00Z' } };
  return { oath: { id, characterId, snapshot: value.preview.snapshot, state: 'scheduled', createdAt: value.serverTime, activatedAt: null as string | null, terminalAt: null as string | null, reason: null as string | null, review: null as { enteredAt: string; closesAt: string } | null }, serverTime: value.serverTime };
}

test.each([
  ['reward amount', (s: Record<string, any>) => { s.rewards.photoTotal = 400; }],
  ['unexpected policy key', (s: Record<string, any>) => { s.rewards.multiplier = 2; }],
  ['changed evidence requirement', (s: Record<string, any>) => { s.evidence.requiresFace = true; }],
  ['claimed layout support', (s: Record<string, any>) => { s.evidence.supportedRecordLayouts = ['apple']; }],
  ['changed provider retry array', (s: Record<string, any>) => { s.review.providerRetryAfterSeconds = [300, 60]; }],
  ['unknown template', (s: Record<string, any>) => { s.templateVersion = 'workout_oath_v2'; }],
  ['unknown activity', (s: Record<string, any>) => { s.activity = 'walking'; }],
  ['missing language', (s: Record<string, any>) => { delete s.copy.pl; }],
  ['missing section', (s: Record<string, any>) => { delete s.copy.en.sections.appeal; }],
  ['unrecognized placeholder', (s: Record<string, any>) => { s.copy.pl.promise += ' {xp}'; }],
  ['repeated placeholder', (s: Record<string, any>) => { s.copy.en.promise += ' {activity}'; }],
  ['blank text', (s: Record<string, any>) => { s.copy.en.sections.privacy = ' '; }],
  ['unbounded text', (s: Record<string, any>) => { s.copy.en.sections.privacy = 'a'.repeat(6001); }],
  ['invalid calendar', (s: Record<string, any>) => { s.deadline.local = '2026-02-30T02:30:00'; }],
  ['UTC offset mismatch', (s: Record<string, any>) => { s.deadline.offset = '+01:00'; }],
  ['receipt grace mismatch', (s: Record<string, any>) => { s.deadline.receiptCutoff = '2026-10-25T00:46:00Z'; }],
  ['invalid UTC normalization', (s: Record<string, any>) => { s.deadline.utc = '2026-10-25T00:30:00.000Z'; }],
  ['scheduled without time', (s: Record<string, any>) => { s.activation.mode = 'scheduled'; }],
])('rejects %s', (_label, mutate) => {
  const value = preview(); mutate(value.preview.snapshot);
  expect(isPreviewEnvelope(value)).toBe(false);
});

test('stored preview keeps saved copy and remains readable after its original deadline', () => {
  const value = preview(); value.preview.snapshot.copy.en.title = 'A previously accepted title';
  expect(isStoredPreviewEnvelope({ preview: value.preview, characterId, oathId: null })).toBe(true);
  expect(isStoredPreviewEnvelope({ preview: value.preview, characterId, oathId: id })).toBe(true);
  expect(isStoredPreviewEnvelope({ preview: value.preview, characterId, oathId: 'other' })).toBe(false);
  expect(isStoredPreviewEnvelope({ preview: value.preview, characterId, oathId: null, extra: true })).toBe(false);
});

test('validates real committed timing and terminal/review metadata', () => {
  const value = oath(); expect(isOathEnvelope(value)).toBe(true);
  value.oath.state = 'active'; expect(isOathEnvelope(value)).toBe(false);
  value.oath.activatedAt = '2026-10-24T20:00:00Z'; expect(isOathEnvelope(value)).toBe(true);
  value.oath.state = 'review_pending'; value.oath.reason = 'service_availability_unknown';
  expect(isOathEnvelope(value)).toBe(false);
  value.oath.review = { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' };
  expect(isOathEnvelope(value)).toBe(true);
  value.oath.review.closesAt = '2026-10-28T00:45:02Z'; expect(isOathEnvelope(value)).toBe(false);
  const withdrawn = oath(); withdrawn.oath.state = 'withdrawn'; withdrawn.oath.reason = 'character_paused';
  expect(isOathEnvelope(withdrawn)).toBe(false);
  withdrawn.oath.terminalAt = withdrawn.oath.createdAt; expect(isOathEnvelope(withdrawn)).toBe(true);
  withdrawn.oath.reason = 'account_paused'; expect(isOathEnvelope(withdrawn)).toBe(false);
});

test('the Oath representation requires its canonical owning character', () => {
  const value = oath(); expect(isOathEnvelope(value)).toBe(true);
  const { characterId: _omitted, ...withoutCharacter } = value.oath;
  expect(isOathEnvelope({ ...value, oath: withoutCharacter })).toBe(false);
  expect(isOathEnvelope({ ...value, oath: { ...value.oath, characterId: characterId.toUpperCase() } })).toBe(false);
  expect(isOathEnvelope({ ...value, oath: { ...value.oath, characterId: null } })).toBe(false);
});

test('rejects activation after deadline and altered effective activation', () => {
  const value = oath(); value.oath.snapshot.activation.time.utc = '2026-10-26T20:00:00Z'; value.oath.snapshot.activation.time.local = '2026-10-26T20:00:00';
  expect(isOathEnvelope(value)).toBe(false);
  const active = oath(); active.oath.state = 'active'; active.oath.activatedAt = '2026-10-24T20:00:01Z';
  expect(isOathEnvelope(active)).toBe(false);
});

test('rejects a list envelope without total', () => {
  const list = { items: [oath().oath], nextCursor: null, serverTime: '2026-10-24T00:00:00Z', paused: false, characterId };
  expect(isOathListEnvelope(list)).toBe(false);
});

test('list envelope total counts the whole view and covers every page', () => {
  const list = { items: [oath().oath], nextCursor: null as string | null, total: 1, serverTime: '2026-10-24T00:00:00Z', paused: false, characterId };
  expect(isOathListEnvelope(list)).toBe(true);
  expect(isOathListEnvelope({ ...list, total: 3 })).toBe(true);
  expect(isOathListEnvelope({ ...list, nextCursor: 'page_1', total: 2 })).toBe(true);
  expect(isOathListEnvelope({ ...list, items: [], total: 0 })).toBe(true);
  expect(isOathListEnvelope({ ...list, total: -1 })).toBe(false);
  expect(isOathListEnvelope({ ...list, total: 1.5 })).toBe(false);
  expect(isOathListEnvelope({ ...list, total: '1' })).toBe(false);
  expect(isOathListEnvelope({ ...list, total: null })).toBe(false);
  expect(isOathListEnvelope({ ...list, total: 0 })).toBe(false);
  expect(isOathListEnvelope({ ...list, nextCursor: 'page_1', total: 1 })).toBe(false);
});

test('list and pause envelopes reject duplicate IDs, unknown fields and unsafe cursors', () => {
  const item = oath().oath;
  const list = { items: [item], nextCursor: null as string | null, total: 1, serverTime: '2026-10-24T00:00:00Z', paused: false, characterId };
  expect(isOathListEnvelope(list)).toBe(true);
  expect(isOathListEnvelope({ ...list, items: [], total: 0, characterId: otherCharacterId })).toBe(true);
  expect(isOathListEnvelope({ ...list, characterId: otherCharacterId })).toBe(false);
  const { characterId: _listCharacter, ...legacyList } = list;
  expect(isOathListEnvelope(legacyList)).toBe(false);
  expect(isOathListEnvelope({ ...list, items: [item, item] })).toBe(false);
  expect(isOathListEnvelope({ ...list, nextCursor: '../bad' })).toBe(false);
  const pause = { paused: false, revision: 'a'.repeat(64), withdraw: [id], preserve: [], serverTime: list.serverTime, characterId };
  expect(isPauseEnvelope(pause)).toBe(true);
  const { characterId: _pauseCharacter, ...legacyPause } = pause;
  expect(isPauseEnvelope(legacyPause)).toBe(false);
  expect(isPauseEnvelope({ ...pause, characterId: 'A'.repeat(36) })).toBe(false);
  expect(isPauseEnvelope({ ...pause, preserve: [id] })).toBe(false);
  expect(isPauseEnvelope({ ...pause, paused: true })).toBe(false);
  expect(isPauseEnvelope({ ...pause, paused: true, withdraw: [] })).toBe(true);
});

test('validates only exact input choices without treating optional offsets as authoritative', () => {
  const input = { activity: 'running', activation: { mode: 'now' }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw' } };
  expect(isPreviewInput(input)).toBe(true);
  expect(isPreviewInput({ ...input, deadline: { ...input.deadline, offset: '+02:00' } })).toBe(true);
  expect(isPreviewInput({ ...input, activation: { mode: 'now', time: null } })).toBe(false);
  expect(isPreviewInput({ ...input, deadline: { ...input.deadline, offset: null } })).toBe(false);
  expect(isPreviewInput({ ...input, accountId: id })).toBe(false);
  expect(isPreviewInput({ ...input, deadline: { ...input.deadline, local: '2026-02-30T00:00:00' } })).toBe(false);
  expect(isUuid(id)).toBe(true);
  expect(isUuid('AAAAAAAA-0000-4000-8000-000000000001')).toBe(false);
});
