import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { getCalendars, getLocales } from 'expo-localization';
import type { ProfileClient } from '../api/profile';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale } from '../localization/locale';
import { createOnboardingController } from '../onboarding/controller';
import { OnboardingView } from '../onboarding/OnboardingView';
import { createNotificationController } from '../onboarding/notifications';
import { nativeNotificationPermissions, type NotificationPermissions } from '../onboarding/notificationPermissions';
import { StatusBar } from 'expo-status-bar';
import type { Authentication, SessionController } from './session';
import { AuthView } from './AuthView';

export type AppleAvailability = { isAvailable(): Promise<boolean>; onRevoked(listener: () => void): () => void };
const nativeApple: AppleAvailability = {
  isAvailable: Apple.isAvailableAsync,
  onRevoked(listener) {
    try {
      const subscription = Apple.addRevokeListener(listener);
      return () => subscription.remove();
    } catch { return () => {}; }
  },
};

// The app owns this controller for its lifetime; account subtrees must not replace it.
export function AuthScreen({ controller, authenticate, profileApi, apple = nativeApple, permissions = nativeNotificationPermissions }: { controller: SessionController; authenticate: Authentication; profileApi: ProfileClient; apple?: AppleAvailability; permissions?: NotificationPermissions }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { i18n } = useTranslation();
  const languageOwner = useRef(i18n);
  languageOwner.current = i18n;
  const onboarding = useMemo(() => createOnboardingController({
    api: profileApi, session: controller,
    applyLocale: locale => languageOwner.current.changeLanguage(locale),
    defaultLocale: () => resolveLocale(getLocales()[0]?.languageTag),
    suggestedTimezone: () => getCalendars()[0]?.timeZone ?? null,
  }), [profileApi, controller]);
  const notifications = useMemo(() => createNotificationController({ session: controller, onboarding, permissions }), [controller, onboarding, permissions]);
  const notificationState = useSyncExternalStore(notifications.subscribe, notifications.getState);
  useEffect(() => { notifications.start(); return () => notifications.stop(); }, [notifications]);
  const profile = useSyncExternalStore(onboarding.subscribe, onboarding.getState);
  useEffect(() => { onboarding.start(); return () => onboarding.stop(); }, [onboarding]);
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const mounted = useRef(false);
  const checkGeneration = useRef(0);
  const checkAvailability = useCallback(async () => {
    const generation = ++checkGeneration.current;
    setAvailability('checking');
    let available = false;
    try { available = await apple.isAvailable(); } catch { /* Only safe availability reaches UI. */ }
    if (mounted.current && generation === checkGeneration.current) setAvailability(available ? 'available' : 'unavailable');
  }, [apple]);
  useEffect(() => {
    mounted.current = true;
    void controller.start();
    void checkAvailability();
    const removeRevocation = apple.onRevoked(() => { void controller.nativeRevoked(); });
    const appState = AppState.addEventListener('change', next => {
      if (next === 'active') {
        void controller.foreground();
        void notifications.refresh();
        void checkAvailability();
      }
    });
    return () => {
      mounted.current = false;
      checkGeneration.current++;
      removeRevocation();
      appState.remove();
    };
  }, [controller, apple, checkAvailability, notifications]);
  if (state.kind === 'authenticated') return <><StatusBar style="light" /><OnboardingView state={profile} notifications={{ state: notificationState, onEnable: () => { void notifications.enable(); }, onSkip: () => { void notifications.skip(); }, onRetryPermission: () => { void notifications.retryPermission(); }, onSettings: () => { void notifications.settings(); } }}
    onComplete={() => { if (!notificationState.busy) void onboarding.complete(); }}
    onIntroduce={() => { void onboarding.save({ companionIntroduced: true }); }} onDraft={onboarding.setDraft} onSave={() => { void onboarding.saveBasics(); }}
    onRetry={() => { void onboarding.refresh(); }} onLogout={() => { void controller.logout(); }} /></>;
  return <><StatusBar style="light" /><AuthView state={state} availability={availability}
    onLogin={() => { if (availability === 'available') void controller.login(authenticate); }}
    onLogout={() => { void controller.logout(); }}
    onRetry={() => { if (state.kind === 'signed_out') void checkAvailability(); else void controller.retry(); }} /></>;
}
