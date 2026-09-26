// DUMMY in-memory adapters for simulator presentation; never a backend authority.
import { createSessionController, type Authentication } from '../src/auth/session';
import type { SessionEnvelope } from '../src/auth/sessionStorage';
import type { ProfileClient, ProfileEnvelope } from '../src/api/profile';
import type { OathClient, OathFailure } from '../src/api/oaths';
import type { Activity, Oath, Preview, ResolvedTime, Snapshot, LocalTimeInput } from '../src/api/oathSchema';
import type { PendingAcceptance } from '../src/oaths/pendingStorage';
import type { Locale } from '../src/localization/locale';

import CATALOG from '../../api/resources/oath/workout_oath_v1.json';
const accountId = '10000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-000000000001';
const token = 'A'.repeat(43);
const success = <T,>(value: T) => ({ kind: 'success' as const, value });
const unavailable = () => ({ kind: 'unavailable' as const, retry: 'request' as const });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const iso = (milliseconds: number) => new Date(Math.floor(milliseconds / 1000) * 1000).toISOString().replace('.000Z', 'Z');
function wall(milliseconds: number, timezone: string) {
  const values = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', calendar: 'gregory', numberingSystem: 'latn' }).formatToParts(new Date(milliseconds));
  const get = (key: string) => values.find(value => value.type === key)!.value;
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
function resolved(milliseconds: number, timezone = 'Europe/Warsaw'): ResolvedTime {
  milliseconds = Math.floor(milliseconds / 1000) * 1000;
  const local = wall(milliseconds, timezone);
  const minutes = (Date.parse(`${local}Z`) - milliseconds) / 60000;
  const offset = `${minutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
  return { local, timezone, offset, explicitOffset: false, utc: iso(milliseconds) };
}
function resolveInput(input: LocalTimeInput, field: 'activation' | 'deadline'): { value: ResolvedTime } | { error: OathFailure } {
  const fail = (code: 'invalid_timezone' | 'invalid_local_time' | 'nonexistent_local_time' | 'offset_mismatch') => ({ error: { kind: 'time_error' as const, code, field } });
  const naive = Date.parse(`${input.local}Z`);
  if (!Number.isFinite(naive) || iso(naive) !== `${input.local}Z`) return fail('invalid_local_time');
  try { wall(naive, input.timezone); } catch { return fail('invalid_timezone'); }
  const candidates: ResolvedTime[] = [];
  // DUMMY resolver for native walkthrough dates; production time authority is the API.
  for (let offsetMinutes = -720; offsetMinutes <= 840; offsetMinutes += 15) {
    const instant = naive - offsetMinutes * 60000;
    if (wall(instant, input.timezone) === input.local) candidates.push(resolved(instant, input.timezone));
  }
  if (!candidates.length) return fail('nonexistent_local_time');
  if (input.offset) {
    const choice = candidates.find(candidate => candidate.offset === input.offset);
    return choice ? { value: { ...choice, explicitOffset: true } } : fail('offset_mismatch');
  }
  if (candidates.length > 1) return { error: { kind: 'time_error', code: 'ambiguous_local_time', field, validOffsets: candidates.map(candidate => candidate.offset) } };
  return { value: candidates[0] };
}
function snapshot(activity: Activity, activation: Snapshot['activation'], deadline: ResolvedTime): Snapshot {
  const rules = clone(CATALOG) as any;
  for (const locale of ['pl', 'en']) { rules.copy[locale].activity = rules.copy[locale].activities[activity]; delete rules.copy[locale].activities; }
  return { ...rules, activity, activation, deadline: { ...deadline, receiptCutoff: iso(Date.parse(deadline.utc) + 900000) } };
}
export function createDummy(locale: Locale, completed: boolean, populated = completed) {
  const initialNow = Math.floor(Date.now() / 1000) * 1000;
  const state = {
    now: initialNow, expired: false, offline: false, loseNext: false, revision: 1, counter: 1,
    profile: { profile: { locale, timezone: 'Europe/Warsaw', intention: completed ? 'regular_activity' : null, companionIntroduced: completed, notificationPreference: completed ? 'disabled' : null }, onboardingStatus: completed ? 'complete' : 'pending' } as ProfileEnvelope,
    session: { version: 1, kind: 'active', session: { token, expiresAt: iso(initialNow + 86400000) } } as SessionEnvelope,
    pending: null as PendingAcceptance | null, previews: new Map<string, Preview>(), accepted: new Map<string, string>(), requests: new Map<string, string>(), oaths: [] as Oath[],
  };
  const id = () => `20000000-0000-4000-8000-${String(state.counter++).padStart(12, '0')}`;
  const guard = (bearer: string) => state.offline ? unavailable() : state.expired || bearer !== token ? { kind: 'reauthenticate' as const } : null;
  function seed(kind: Oath['state'], delta = 0) {
    const scheduled = kind === 'scheduled' || kind === 'withdrawn';
    const activation = state.now + (scheduled ? 3600000 : -14400000) + delta;
    const deadline = kind === 'review_pending' ? state.now - 7200000 : state.now + 14400000 + delta;
    const row: Oath = { id: id(), characterId, state: kind, snapshot: snapshot(kind === 'scheduled' ? 'mobility' : kind === 'withdrawn' ? 'strength_training' : 'running', { mode: scheduled ? 'scheduled' : 'now', time: resolved(activation) }, resolved(deadline)),
      createdAt: iso(scheduled ? state.now - 86400000 : activation), activatedAt: scheduled ? null : iso(activation),
      terminalAt: kind === 'withdrawn' ? iso(state.now - 1000 + delta) : null, reason: kind === 'withdrawn' ? 'character_paused' : kind === 'review_pending' ? 'service_availability_unknown' : null,
      review: kind === 'review_pending' ? { enteredAt: iso(state.now - 3600000), closesAt: iso(state.now + 255600000) } : null };
    state.oaths.push(row); state.revision++; return row;
  }
  if (populated) { seed('scheduled'); seed('active'); seed('review_pending'); for (let i = 0; i < 22; i++) seed('withdrawn', -i * 60000); }
  let paused = false;
  function reconcile() {
    for (const oath of state.oaths) {
      if (oath.state === 'scheduled' && Date.parse(oath.snapshot.activation.time!.utc) <= state.now) { oath.state = 'active'; oath.activatedAt = oath.snapshot.activation.time!.utc; state.revision++; }
      if (oath.state === 'active' && Date.parse(oath.snapshot.deadline.receiptCutoff) < state.now) { oath.state = 'review_pending'; oath.reason = 'service_availability_unknown'; oath.review = { enteredAt: iso(state.now), closesAt: iso(state.now + 259200000) }; state.revision++; }
    }
  }
  const pauseSummary = () => { reconcile(); return { paused, revision: state.revision.toString(16).padStart(64, '0'), withdraw: state.oaths.filter(oath => ['scheduled', 'active'].includes(oath.state)).map(oath => oath.id), preserve: state.oaths.filter(oath => ['review_pending', 'proof_pending', 'needs_more_evidence'].includes(oath.state)).map(oath => oath.id), serverTime: iso(state.now), characterId }; };
  const oathApi: OathClient = {
    async preview(bearer, input) {
      const denied = guard(bearer); if (denied) return denied;
      if (paused) return { kind: 'oath_error', code: 'character_paused' };
      if (state.profile.onboardingStatus !== 'complete') return { kind: 'oath_error', code: 'onboarding_incomplete' };
      const deadline = resolveInput(input.deadline, 'deadline'); if ('error' in deadline) return deadline.error;
      let activation: Snapshot['activation'] = { mode: 'now', time: null };
      if (input.activation.mode === 'scheduled') {
        const time = resolveInput(input.activation.time, 'activation'); if ('error' in time) return time.error;
        if (Date.parse(time.value.utc) <= state.now) return { kind: 'oath_error', code: 'activation_elapsed' };
        activation = { mode: 'scheduled', time: time.value };
      }
      if (Date.parse(deadline.value.utc) <= (activation.time ? Date.parse(activation.time.utc) : state.now)) return { kind: 'oath_error', code: 'deadline_not_after_activation' };
      const preview: Preview = { id: id(), snapshot: snapshot(input.activity, activation, deadline.value) }; state.previews.set(preview.id, preview);
      return success({ preview: clone(preview), characterId, serverTime: iso(state.now) });
    },
    async getPreview(bearer, previewId) {
      const denied = guard(bearer); if (denied) return denied;
      const preview = state.previews.get(previewId); return preview ? success({ preview: clone(preview), characterId, oathId: state.accepted.get(previewId) ?? null }) : { kind: 'oath_error', code: 'not_found' };
    },
    async confirm(bearer, input) {
      const denied = guard(bearer); if (denied) return denied;
      const requestPreview = state.requests.get(input.requestId);
      if (requestPreview && requestPreview !== input.previewId) return { kind: 'oath_error', code: 'idempotency_conflict' };
      const existing = state.oaths.find(oath => oath.id === state.accepted.get(input.previewId));
      if (existing) { reconcile(); return success({ oath: clone(existing), serverTime: iso(state.now) }); }
      if (paused) return { kind: 'oath_error', code: 'character_paused' };
      const preview = state.previews.get(input.previewId); if (!preview) return { kind: 'oath_error', code: 'not_found' };
      const rules = clone(preview.snapshot);
      if (rules.activation.time && Date.parse(rules.activation.time.utc) <= state.now) return { kind: 'oath_error', code: 'activation_elapsed' };
      if (Date.parse(rules.deadline.utc) <= state.now) return { kind: 'oath_error', code: 'deadline_not_after_activation' };
      rules.activation.time ??= resolved(state.now, rules.deadline.timezone);
      const oath: Oath = { id: id(), characterId, snapshot: rules, state: rules.activation.mode === 'now' ? 'active' : 'scheduled', createdAt: iso(state.now), activatedAt: rules.activation.mode === 'now' ? iso(state.now) : null, terminalAt: null, reason: null, review: null };
      state.oaths.push(oath); state.accepted.set(input.previewId, oath.id); state.requests.set(input.requestId, input.previewId); state.revision++;
      if (state.loseNext) { state.loseNext = false; return unavailable(); }
      return success({ oath: clone(oath), serverTime: iso(state.now) });
    },
    async detail(bearer, oathId) {
      const denied = guard(bearer); if (denied) return denied; reconcile();
      const oath = state.oaths.find(oath => oath.id === oathId); return oath ? success({ oath: clone(oath), serverTime: iso(state.now) }) : { kind: 'oath_error', code: 'not_found' };
    },
    async list(bearer, query) {
      const denied = guard(bearer); if (denied) return denied; reconcile();
      const rows = state.oaths.filter(oath => query.view === 'history' ? oath.terminalAt !== null : oath.terminalAt === null).sort((a, b) => query.view === 'history' ? b.terminalAt!.localeCompare(a.terminalAt!) || b.id.localeCompare(a.id) : a.snapshot.deadline.utc.localeCompare(b.snapshot.deadline.utc) || a.id.localeCompare(b.id));
      const start = Number(query.cursor?.replace('page_', '') ?? 0), limit = query.limit ?? 20;
      return success({ items: clone(rows.slice(start, start + limit)), nextCursor: rows.length > start + limit ? `page_${start + limit}` : null, serverTime: iso(state.now), paused, characterId });
    },
    async getPause(bearer) { const denied = guard(bearer); return denied ?? success(pauseSummary()); },
    async pause(bearer, input) {
      const denied = guard(bearer); if (denied) return denied;
      if (input.characterId !== characterId) return { kind: 'oath_error', code: 'character_changed' };
      const before = pauseSummary();
      if (input.paused && !paused && input.revision !== before.revision) return { kind: 'oath_error', code: 'pause_preview_changed' };
      if (input.paused && !paused) for (const oath of state.oaths) if (before.withdraw.includes(oath.id)) { oath.state = 'withdrawn'; oath.terminalAt = iso(state.now); oath.reason = 'character_paused'; }
      if (paused !== input.paused) state.revision++; paused = input.paused;
      return success(pauseSummary());
    },
  };
  const profileApi: ProfileClient = {
    async get(bearer) { return guard(bearer) ?? success(clone(state.profile)); },
    async patch(bearer, patch) { const denied = guard(bearer); if (denied) return denied; Object.assign(state.profile.profile, patch); return success(clone(state.profile)); },
    async complete(bearer) { const denied = guard(bearer); if (denied) return denied;
      const p = state.profile.profile;
      if (!p.locale || !p.timezone || !p.intention || !p.companionIntroduced || !p.notificationPreference) return { kind: 'onboarding_incomplete' };
      state.profile.onboardingStatus = 'complete'; return success(clone(state.profile)); },
  };
  function runtime() {
    const account = () => ({ id: accountId, onboardingStatus: state.profile.onboardingStatus });
    const controller = createSessionController({ now: () => state.now,
      api: { async me(bearer) { return guard(bearer) ?? success({ account: account() }); }, async logout() { return success(undefined); } },
      storage: { async read() { return success(clone(state.session)); }, async write(value) { state.session = clone(value); return { kind: 'success' }; } },
    });
    const authenticate: Authentication = async () => { state.expired = false; return success({ account: account(), session: { token, expiresAt: iso(state.now + 86400000) } }); };
    return { controller, authenticate, profileApi, oathApi,
      acceptanceStorage: { async read(owner: string) { return success(state.pending?.accountId === owner ? clone(state.pending) : null); }, async write(owner: string, value: PendingAcceptance | null) { if (value && value.accountId !== owner) return { kind: 'unavailable' as const }; state.pending = clone(value); return { kind: 'success' as const }; } },
      apple: { async isAvailable() { return true; }, onRevoked() { return () => {}; } },
      permissions: { async read() { return { kind: 'denied' as const, canAskAgain: false }; }, async request() { return { kind: 'denied' as const, canAskAgain: false }; }, async openSettings() { return false; } },
    };
  }
  return { state, runtime, add: () => seed('active') };
}
