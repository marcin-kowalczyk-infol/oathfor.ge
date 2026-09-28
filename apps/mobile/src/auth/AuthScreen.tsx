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
import type { GuideStorage } from '../forge/guideStorage';
import { HomeRoutes } from '../home/HomeRoutes';
import type { HomeState } from '../home/homeRoute';
import type { Locale } from '../localization/locale';
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
export function AuthScreen({ controller, authenticate, profileApi, oathApi, acceptanceStorage, characterApi, creationStorage, guideStorage, rulesGuideStorage, apple = nativeApple, permissions = nativeNotificationPermissions }: { controller: SessionController; authenticate: Authentication; profileApi: ProfileClient; oathApi: OathClient; acceptanceStorage: PendingStorage; characterApi: CharacterClient; creationStorage: CreationStorage; guideStorage: GuideStorage; rulesGuideStorage?: GuideStorage; apple?: AppleAvailability; permissions?: NotificationPermissions }) {
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
  // A new active character starts the next creation from an empty draft.
  useEffect(() => { setCreationDraft({ accountId, draft: emptyCreationDraft }); }, [accountId, activeCharacterId]);
  // Home routes and the Settings language attempt belong to the account. A session check keeps them, so the player returns to the same screen.
  // Leaving the account, for example a sign-out, starts the next sign-in at the menu.
  const [home, setHome] = useState<HomeState | null>(null);
  const [language, setLanguage] = useState<{ accountId: string | null; saving: boolean; error: boolean }>({ accountId: null, saving: false, error: false });
  const accountKept = state.kind === 'authenticated' || state.kind === 'validating' || state.kind === 'verification_unavailable';
  useEffect(() => { if (!accountKept) { setHome(null); setLanguage({ accountId: null, saving: false, error: false }); } }, [accountKept]);
  const languageState = language.accountId === accountId ? { saving: language.saving, error: language.error } : { saving: false, error: false };
  function saveLocale(locale: Locale) {
    const owner = accountId;
    setLanguage({ accountId: owner, saving: true, error: false });
    const settle = (saved: boolean) => setLanguage(current => current.accountId === owner ? { accountId: owner, saving: false, error: !saved } : current);
    onboarding.save({ locale }).then(settle, () => settle(false));
  }
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
    // Only a return from the background checks the session again. An alert, such as the notification permission prompt, only makes the app inactive.
    let backgrounded = false;
    const appState = AppState.addEventListener('change', next => {
      if (next === 'background') backgrounded = true;
      if (next === 'active' && backgrounded) {
        backgrounded = false;
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
    const active = characterState.characters.find(item => item.id === characterState.activeCharacterId);
    // First creation offers sign-out, a later one returns to the character screens.
    const creation = (onCancel?: () => void) => <CharacterCreationScreen state={characterState} draft={draft} onDraft={onCharacterDraft}
      onCreate={value => { void characters.create(value); }} onRetry={() => { void characters.retryCreation(); }} onReload={() => { void characters.refresh(); }}
      {...(onCancel ? { onCancel } : { onSignOut: () => { void controller.logout(); } })} />;
    if (!active) return <><StatusBar style="light" />{creation()}</>;
    if (!oathsBound) return <><StatusBar style="light" /><CharacterStatusView state={{ kind: 'loading' }} onRetry={() => { void characters.refresh(); }} onLogout={() => { void controller.logout(); }} /></>;
    // Routes belong to this account and character. A switch or a created character resets them to the menu.
    return <><StatusBar style="light" />
      <HomeRoutes key={state.account.id} accountId={state.account.id} character={active} characterState={characterState} characters={characters} oaths={oaths}
        profile={profile.value.profile} timezone={profile.value.profile.timezone!} guideStorage={guideStorage} rulesGuideStorage={rulesGuideStorage}
        home={home} onHome={setHome} language={languageState} onLocale={saveLocale}
        onSettingsOpened={() => setLanguage(current => current.saving ? current : { ...current, error: false })}
        notifications={{ state: notificationState, enable: () => { void notifications.enable(); }, skip: () => { void notifications.skip(); }, retryPermission: () => { void notifications.retryPermission(); }, settings: () => { void notifications.settings(); } }}
        renderCreation={creation} onSignOut={() => { void controller.logout(); }} />
    </>;
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
