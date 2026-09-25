import type { SessionController } from '../auth/session';
import { isSupportedTimezone } from '../api/profile';
import type { OnboardingController } from './controller';
import type { DevicePermission, NotificationPermissions } from './notificationPermissions';

export type NotificationState = { permission: DevicePermission | { kind: 'checking'; canAskAgain: false }; busy: boolean; error?: 'save' | 'settings' | undefined };
const initial = (): NotificationState => ({ permission: { kind: 'checking', canAskAgain: false }, busy: false });

// Lives beside the profile owner: saving a preference must not unmount its OS action.
export function createNotificationController({ session, onboarding, permissions }: { session: SessionController; onboarding: OnboardingController; permissions: NotificationPermissions }) {
  let state = initial();
  let binding: string | undefined;
  let generation = 0;
  let readSequence = 0;
  let active = false;
  let eligibleBefore = false;
  let refreshNeeded = false;
  let unsubscribe: (() => void)[] = [];
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<NotificationState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const eligible = () => {
    const profile = onboarding.getState();
    return active && session.getState().kind === 'authenticated' && profile.kind === 'ready'
      && profile.value.onboardingStatus === 'pending' && !!profile.value.profile.locale
      && isSupportedTimezone(profile.value.profile.timezone) && !!profile.value.profile.intention && profile.value.profile.companionIntroduced;
  };
  const preference = () => { const profile = onboarding.getState(); return profile.kind === 'ready' ? profile.value.profile.notificationPreference : null; };
  const current = (owner: number) => active && owner === generation && eligible();
  async function refresh() {
    if (!eligible()) { refreshNeeded = true; return; }
    if (state.busy) { refreshNeeded = true; return; }
    refreshNeeded = false;
    const owner = generation, sequence = ++readSequence;
    const permission = await permissions.read();
    if (current(owner) && sequence === readSequence) publish({ permission });
  }
  function sync() {
    const auth = session.getState();
    if (auth.kind === 'authenticated') {
      const next = `${auth.account.id}:${session.getToken()}`;
      if (next !== binding) { binding = next; generation++; readSequence++; state = initial(); publish({}); eligibleBefore = false; }
    } else if (auth.kind !== 'validating' && auth.kind !== 'verification_unavailable') {
      if (binding !== undefined) { binding = undefined; generation++; readSequence++; refreshNeeded = false; state = initial(); publish({}); }
    }
    const nextEligible = eligible();
    if (nextEligible && !eligibleBefore) { eligibleBefore = true; void refresh(); }
    else eligibleBefore = nextEligible;
  }
  async function action(run: (owner: number) => Promise<void>) {
    if (!eligible() || state.busy) return;
    const owner = generation;
    readSequence++;
    publish({ busy: true, error: undefined });
    try { await run(owner); }
    finally {
      // Validation temporarily hides the subtree but must not strand a native action.
      if (active && generation === owner) {
        publish({ busy: false });
        if (refreshNeeded) void refresh();
      }
    }
  }
  async function request(owner: number) {
    const permission = await permissions.request();
    if (current(owner)) publish({ permission });
    else if (active && generation === owner) refreshNeeded = true;
  }
  async function save(preference: 'enabled' | 'disabled') {
    await action(async owner => {
      const saved = await onboarding.save({ notificationPreference: preference });
      if (!current(owner)) return;
      if (!saved) { publish({ error: 'save' }); return; }
      if (preference === 'enabled' && !['granted', 'provisional', 'ephemeral'].includes(state.permission.kind)
        && (state.permission.canAskAgain || state.permission.kind === 'unavailable' || state.permission.kind === 'checking')) await request(owner);
    });
  }
  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => { if (active) return; active = true; unsubscribe = [session.subscribe(sync), onboarding.subscribe(sync)]; sync(); },
    stop: () => { active = false; generation++; readSequence++; unsubscribe.forEach(remove => remove()); unsubscribe = []; binding = undefined; eligibleBefore = false; state = initial(); },
    refresh, enable: () => save('enabled'), skip: () => save('disabled'),
    retryPermission: () => action(async owner => { if (preference() === 'enabled' && state.permission.canAskAgain && !['granted', 'provisional', 'ephemeral'].includes(state.permission.kind)) await request(owner); }),
    settings: () => action(async owner => { const opened = await permissions.openSettings(); if (current(owner) && !opened) publish({ error: 'settings' }); }),
  };
}
