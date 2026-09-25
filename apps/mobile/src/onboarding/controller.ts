import { isSupportedTimezone, type ProfileClient, type ProfileEnvelope, type ProfilePatch, type ProfileResult } from '../api/profile';
import type { SessionController } from '../auth/session';
import type { Locale } from '../localization/locale';

export type BasicsDraft = { locale: Locale; timezone: string; intention: boolean };
type FormError = 'save' | 'timezone' | 'intention' | 'locale' | 'load' | 'complete';
export type OnboardingState = { kind: 'idle' | 'loading' | 'unavailable' }
  | { kind: 'ready'; value: ProfileEnvelope; draft: BasicsDraft; busy: boolean; error?: FormError };

export function createOnboardingController(options: {
  api: ProfileClient; session: SessionController; applyLocale(locale: Locale): Promise<unknown>;
  defaultLocale(): Locale; suggestedTimezone(): string | null;
}) {
  let state: OnboardingState = { kind: 'idle' };
  let binding: { key: string; token: string } | undefined;
  let value: ProfileEnvelope | undefined;
  let draft: BasicsDraft | undefined;
  let ambiguous: ProfilePatch | undefined;
  let ambiguousCompletion = false;
  let generation = 0;
  let disposed = false;
  let unsubscribe: (() => void) | undefined;
  let writes: Promise<unknown> = Promise.resolve();
  let languages: Promise<unknown> = Promise.resolve();
  const requests = new Set<AbortController>();
  const listeners = new Set<() => void>();
  const epochMatches = (epoch: number) => !disposed && epoch === generation;
  const current = (epoch: number) => epochMatches(epoch) && binding !== undefined && options.session.getToken() === binding.token;
  function publish(next: OnboardingState) { if (!disposed) { state = next; listeners.forEach(listener => listener()); } }
  function ready(busy = false, error?: FormError) { if (value && draft) publish({ kind: 'ready', value, draft, busy, ...(error ? { error } : {}) }); }
  function invalidate() { generation++; requests.forEach(request => request.abort()); requests.clear(); return generation; }
  function language(locale: Locale, epoch: number): Promise<boolean> {
    const task = languages.then(async () => {
      if (!epochMatches(epoch)) return false;
      try { await options.applyLocale(locale); return epochMatches(epoch); } catch { return false; }
    });
    languages = task;
    return task;
  }
  async function request(action: (signal: AbortSignal) => Promise<ProfileResult<ProfileEnvelope>>) {
    const controller = new AbortController(); requests.add(controller);
    try { return await action(controller.signal); }
    catch { return { kind: 'unavailable' as const, retry: 'request' as const }; }
    finally { requests.delete(controller); }
  }
  function suggested(): BasicsDraft { return { locale: options.defaultLocale(), timezone: options.suggestedTimezone() ?? '', intention: false }; }
  function fromProfile(next: ProfileEnvelope): BasicsDraft {
    const defaults = suggested();
    return { locale: next.profile.locale ?? defaults.locale, timezone: next.profile.timezone ?? defaults.timezone, intention: next.profile.intention === 'regular_activity' };
  }
  const matches = (next: ProfileEnvelope, patch: ProfilePatch) => Object.entries(patch).every(([field, expected]) => next.profile[field as keyof ProfilePatch] === expected);
  async function accept(next: ProfileEnvelope, epoch: number, confirmedPatch?: ProfilePatch): Promise<boolean> {
    if (!current(epoch)) return false;
    const previous = value ? fromProfile(value) : suggested();
    const incoming = fromProfile(next);
    const nextDraft = draft ? { ...draft } : incoming;
    if (draft) {
      for (const field of ['locale', 'timezone', 'intention'] as const) {
        if (draft[field] === previous[field] || confirmedPatch?.[field] !== undefined) Object.assign(nextDraft, { [field]: incoming[field] });
      }
    }
    if (!await language(next.profile.locale ?? options.defaultLocale(), epoch) || !current(epoch)) return false;
    value = next; draft = nextDraft; ready();
    return true;
  }
  async function denied(result: ProfileResult<ProfileEnvelope>, epoch: number) {
    if (result.kind !== 'reauthenticate' || !current(epoch)) return false;
    await options.session.reauthenticate();
    return true;
  }
  async function load(epoch: number) {
    if (!current(epoch)) return;
    const token = binding!.token;
    const result = await request(signal => options.api.get(token, signal));
    if (!current(epoch) || await denied(result, epoch)) return;
    if (result.kind !== 'success' || !await accept(result.value, epoch)) {
      if (current(epoch)) publish({ kind: 'unavailable' });
    }
  }
  function onSession() {
    const auth = options.session.getState();
    const token = options.session.getToken();
    const epoch = invalidate();
    if (auth.kind === 'authenticated' && token) {
      const key = `${auth.account.id}:${token}`;
      if (binding?.key !== key) { value = undefined; draft = undefined; ambiguous = undefined; ambiguousCompletion = false; }
      binding = { key, token };
      publish({ kind: 'loading' });
      void load(epoch);
    } else {
      publish({ kind: 'idle' });
      // A foreground identity check hides access but keeps this account's language.
      if (auth.kind !== 'validating' && auth.kind !== 'verification_unavailable') {
        binding = undefined; value = undefined; draft = undefined; ambiguous = undefined; ambiguousCompletion = false;
        void language(options.defaultLocale(), epoch);
      }
    }
  }
  async function refresh() {
    if (!binding || !options.session.getToken()) return;
    const epoch = invalidate();
    publish({ kind: 'loading' });
    await load(epoch);
  }
  async function reconcile(patch: ProfilePatch, epoch: number): Promise<'saved' | 'different' | 'unavailable'> {
    if (!current(epoch)) return 'unavailable';
    const result = await request(signal => options.api.get(binding!.token, signal));
    if (!current(epoch) || await denied(result, epoch)) return 'unavailable';
    if (result.kind !== 'success') { ready(false, 'load'); return 'unavailable'; }
    const saved = matches(result.value, patch);
    if (!await accept(result.value, epoch, saved ? patch : undefined)) { if (current(epoch)) ready(false, 'load'); return 'unavailable'; }
    ambiguous = undefined;
    if (!saved) ready(false, 'save');
    return saved ? 'saved' : 'different';
  }
  function save(patch: ProfilePatch): Promise<boolean> {
    const epoch = generation;
    const job = writes.then(async () => {
      if (!current(epoch) || !value || !draft) return false;
      ready(true);
      if (ambiguous) {
        const pending = ambiguous;
        const outcome = await reconcile(pending, epoch);
        if (outcome === 'unavailable') return false;
        if (outcome === 'saved' && Object.entries(patch).every(([key, expected]) => pending[key as keyof ProfilePatch] === expected)) return true;
        if (!current(epoch)) return false;
        ready(true);
      }
      ambiguous = patch;
      const result = await request(signal => options.api.patch(binding!.token, patch, signal));
      if (!current(epoch) || await denied(result, epoch)) return false;
      if (result.kind === 'success') {
        ambiguous = undefined;
        const saved = matches(result.value, patch);
        const accepted = await accept(result.value, epoch, saved ? patch : undefined);
        if (!accepted || !saved) { if (current(epoch)) ready(false, 'save'); return false; }
        return true;
      }
      if (result.kind === 'invalid_value' || result.kind === 'invalid_request' || result.kind === 'onboarding_incomplete') {
        ambiguous = undefined;
        const field = result.kind === 'invalid_value' ? result.field : undefined;
        ready(false, field === 'locale' || field === 'timezone' || field === 'intention' ? field : 'save');
        return false;
      }
      ambiguous = patch;
      return await reconcile(patch, epoch) === 'saved';
    });
    writes = job;
    return job;
  }
  async function reconcileCompletion(epoch: number): Promise<'complete' | 'pending' | 'unavailable'> {
    if (!current(epoch)) return 'unavailable';
    const result = await request(signal => options.api.get(binding!.token, signal));
    if (!current(epoch) || await denied(result, epoch)) return 'unavailable';
    if (result.kind !== 'success' || !await accept(result.value, epoch)) {
      if (current(epoch)) ready(false, 'load');
      return 'unavailable';
    }
    ambiguousCompletion = false;
    if (result.value.onboardingStatus === 'complete') return 'complete';
    ready(false, 'complete');
    return 'pending';
  }
  function complete(): Promise<boolean> {
    const epoch = generation;
    const job = writes.then(async () => {
      if (!current(epoch) || !value || !draft) return false;
      if (value.onboardingStatus === 'complete') return true;
      ready(true);
      if (ambiguous) {
        if (await reconcile(ambiguous, epoch) === 'unavailable' || !current(epoch)) return false;
      }
      if (ambiguousCompletion) {
        const outcome = await reconcileCompletion(epoch);
        if (outcome !== 'pending') return outcome === 'complete';
        if (!current(epoch)) return false;
      }
      ready(true);
      // Mark before sending so foreground validation cannot erase an uncertain write.
      ambiguousCompletion = true;
      const result = await request(signal => options.api.complete(binding!.token, signal));
      if (!current(epoch) || await denied(result, epoch)) return false;
      if (result.kind === 'success') {
        ambiguousCompletion = false;
        if (!await accept(result.value, epoch)) { if (current(epoch)) ready(false, 'complete'); return false; }
        if (result.value.onboardingStatus === 'complete') return true;
        ready(false, 'complete'); return false;
      }
      // A rejected guard must reload authoritative missing fields before routing.
      return await reconcileCompletion(epoch) === 'complete';
    });
    writes = job;
    return job;
  }
  function setDraft(patch: Partial<BasicsDraft>) {
    if (state.kind !== 'ready' || state.busy || !draft) return;
    draft = { ...draft, ...patch }; ready();
    if (patch.locale) {
      const epoch = generation;
      void language(patch.locale, epoch).then(ok => { if (!ok && current(epoch)) ready(false, 'locale'); });
    }
  }
  async function saveBasics() {
    if (state.kind !== 'ready' || state.busy || !draft || !value) return false;
    if (!isSupportedTimezone(draft.timezone)) { ready(false, 'timezone'); return false; }
    if (!draft.intention) { ready(false, 'intention'); return false; }
    const patch: ProfilePatch = {};
    if (draft.locale !== value.profile.locale) patch.locale = draft.locale;
    if (draft.timezone !== value.profile.timezone) patch.timezone = draft.timezone;
    if (value.profile.intention !== 'regular_activity') patch.intention = 'regular_activity';
    return Object.keys(patch).length === 0 || save(patch);
  }
  return {
    getState: () => state, refresh, save, saveBasics, setDraft, complete,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { if (!disposed && !unsubscribe) { unsubscribe = options.session.subscribe(onSession); onSession(); } },
    stop() { invalidate(); unsubscribe?.(); unsubscribe = undefined; publish({ kind: 'idle' }); },
    dispose() { disposed = true; invalidate(); unsubscribe?.(); unsubscribe = undefined; listeners.clear(); },
  };
}
export type OnboardingController = ReturnType<typeof createOnboardingController>;
