import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { getCalendars, getLocales } from 'expo-localization';
import type { ProfileClient } from '../api/profile';
import type { OathClient } from '../api/oaths';
import type { PendingStorage } from '../oaths/pendingStorage';
import type { CharacterClient } from '../api/characters';
import type { CreationStorage } from '../characters/creationStorage';
import { createCharacterController } from '../characters/controller';
import { CharacterCreationScreen, emptyCreationDraft, type CharacterCreationDraft } from '../characters/CharacterCreationScreen';
import { CharacterStatusView } from '../characters/CharacterStatusView';
import { createOathController } from '../oaths/controller';
import { OathHomeScreen, type ForgeNavigation } from '../oaths/OathHomeScreen';
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
      // The SDK fallback returns undefined when its native module is unavailable.
      return () => subscription?.remove();
    } catch { return () => {}; }
  },
};

// The app owns this controller for its lifetime; account subtrees must not replace it.
export function AuthScreen({ controller, authenticate, profileApi, oathApi, acceptanceStorage, characterApi, creationStorage, apple = nativeApple, permissions = nativeNotificationPermissions, forgeNavigation }: { controller: SessionController; authenticate: Authentication; profileApi: ProfileClient; oathApi: OathClient; acceptanceStorage: PendingStorage; characterApi: CharacterClient; creationStorage: CreationStorage; apple?: AppleAvailability; permissions?: NotificationPermissions; forgeNavigation?: ForgeNavigation }) {
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
  const characters = useMemo(() => createCharacterController({ session: controller, api: characterApi, storage: creationStorage }), [controller, characterApi, creationStorage]);
  const characterState = useSyncExternalStore(characters.subscribe, characters.getState);
  const oaths = useMemo(() => createOathController({ session: controller, api: oathApi, storage: acceptanceStorage, onCharacterRequired: () => { void characters.refresh(); }, onCharacterChanged: () => { void characters.refresh(); } }), [controller, oathApi, acceptanceStorage, characters]);
  const profileComplete = state.kind === 'authenticated' && profile.kind === 'ready' && profile.value.onboardingStatus === 'complete';
  useEffect(() => { if (profileComplete) characters.start(); return () => characters.stop(); }, [characters, profileComplete]);
  useEffect(() => { if (profileComplete) oaths.start(); return () => oaths.stop(); }, [oaths, profileComplete]);
  const accountId = state.kind === 'authenticated' ? state.account.id : null;
  const activeCharacterId = characterState.kind === 'ready' ? characterState.activeCharacterId : null;
  // The Oath controller follows the active character. A change aborts its requests and loads that character's content.
  // A layout effect rebinds before child effects can send anything, and the Oath screens wait for the rebind below.
  useLayoutEffect(() => { oaths.setCharacter(accountId && activeCharacterId ? { accountId, characterId: activeCharacterId } : null); }, [oaths, accountId, activeCharacterId]);
  useSyncExternalStore(oaths.subscribe, oaths.getState);
  const bound = oaths.boundCharacter();
  const oathsBound = bound !== null && bound.accountId === accountId && bound.characterId === activeCharacterId;
  const [creationDraft, setCreationDraft] = useState<{ accountId: string | null; draft: CharacterCreationDraft }>({ accountId: null, draft: emptyCreationDraft });
  // A creation draft belongs to one account.
  const draft = creationDraft.accountId === accountId ? creationDraft.draft : emptyCreationDraft;
  const onCharacterDraft = useCallback((patch: Partial<CharacterCreationDraft>) => setCreationDraft(current => ({ accountId, draft: { ...(current.accountId === accountId ? current.draft : emptyCreationDraft), ...patch } })), [accountId]);
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
  if (state.kind === 'authenticated' && profileComplete && profile.kind === 'ready') {
    if (characterState.kind !== 'ready') return <><StatusBar style="light" /><CharacterStatusView state={characterState} onRetry={() => { void characters.refresh(); }} onLogout={() => { void controller.logout(); }} /></>;
    if (characterState.activeCharacterId === null) return <><StatusBar style="light" /><CharacterCreationScreen state={characterState} draft={draft} onDraft={onCharacterDraft}
      onCreate={value => { void characters.create(value); }} onRetry={() => { void characters.retryCreation(); }} onReload={() => { void characters.refresh(); }} /></>;
    if (!oathsBound) return <><StatusBar style="light" /><CharacterStatusView state={{ kind: 'loading' }} onRetry={() => { void characters.refresh(); }} onLogout={() => { void controller.logout(); }} /></>;
    // Keyed by character, so lists reload and Oath drafts start fresh after a switch.
    return <><StatusBar style="light" /><OathHomeScreen forgeNavigation={forgeNavigation} key={`${state.account.id}.${characterState.activeCharacterId}`} controller={oaths} timezone={profile.value.profile.timezone!} onLogout={() => { void controller.logout(); }} /></>;
  }
  if (state.kind === 'authenticated') return <><StatusBar style="light" /><OnboardingView state={profile} notifications={{ state: notificationState, onEnable: () => { void notifications.enable(); }, onSkip: () => { void notifications.skip(); }, onRetryPermission: () => { void notifications.retryPermission(); }, onSettings: () => { void notifications.settings(); } }}
    onComplete={() => { if (!notificationState.busy) void onboarding.complete(); }}
    onIntroduce={() => { void onboarding.save({ companionIntroduced: true }); }} onDraft={onboarding.setDraft} onSave={() => { void onboarding.saveBasics(); }}
    onRetry={() => { void onboarding.refresh(); }} onLogout={() => { void controller.logout(); }} /></>;
  return <><StatusBar style="light" /><AuthView state={state} availability={availability}
    onLogin={() => { if (availability === 'available') void controller.login(authenticate); }}
    onLogout={() => { void controller.logout(); }}
    onRetry={() => { if (state.kind === 'signed_out') void checkAvailability(); else void controller.retry(); }} /></>;
}
