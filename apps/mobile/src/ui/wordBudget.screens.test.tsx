import { useState } from 'react';
import { AccessibilityInfo, Dimensions, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import baseline from './wordBudget.baseline.json';
import { Text } from './Text';
import { ratchetProblem, visibleWords, WORD_BUDGET, words, type Ceiling } from './wordBudget';
import type { Character } from '../api/characters';
import type { Oath } from '../api/oathSchema';
import type { SessionController } from '../auth/session';
import type { OathClient } from '../api/oaths';
import { AuthView } from '../auth/AuthView';
import { ChangeCharacterScreen } from '../characters/ChangeCharacterScreen';
import { CharacterCreationScreen, emptyCreationDraft, type CharacterCreationDraft } from '../characters/CharacterCreationScreen';
import type { CharacterControllerState } from '../characters/controller';
import { ForgeRoom } from '../forge/ForgeRoom';
import type { GuideStorage } from '../forge/guideStorage';
import { MainMenuScreen } from '../home/MainMenuScreen';
import { TutorialScreen } from '../home/TutorialScreen';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';
import en from '../localization/locales/en/messages.json';
import pl from '../localization/locales/pl/messages.json';
import { createOathController, type OathController, type OathControllerState } from '../oaths/controller';
import { OathHomeScreen } from '../oaths/OathHomeScreen';
import { OathScreen, type OathCreationDraft } from '../oaths/OathScreen';
import type { PendingStorage } from '../oaths/pendingStorage';
import { createServerClock } from '../oaths/serverClock';
import { OnboardingView, type OnboardingViewProps } from '../onboarding/OnboardingView';
import type { ProofController, ProofControllerState } from '../proof/proofController';
import { ProofScreen } from '../proof/ProofScreen';
import { PauseReviewScreen } from '../settings/PauseReviewScreen';
import { SettingsScreen } from '../settings/SettingsScreen';

// Word budget ratchet (docs/product/engagement.md E1, D-E4): every named screen state at 402 x 874 pt, font scale 1, motion off,
// in Polish and English, against its ceiling in wordBudget.baseline.json. The fixtures follow each screen's own tests.
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }], getCalendars: () => [{ timeZone: 'Europe/Warsaw' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } }));
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation((uri: string) => ({ uri, exists: true, delete: () => {} })) }));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  return { AppleAuthenticationButton: (props: object) => <Pressable {...props} />, AppleAuthenticationButtonType: { SIGN_IN: 0 }, AppleAuthenticationButtonStyle: { WHITE: 0 } };
});
jest.mock('./useMotion', () => ({ ...jest.requireActual('./useMotion'), useMotionAllowed: () => false }));
// Decorative loops draw no text and own their own timers.
jest.mock('./HearthFire', () => ({ HearthFire: () => null }));
jest.mock('../forge/Sprite', () => ({ ...jest.requireActual('../forge/Sprite'), SpriteLoop: () => null }));

const ceilings = baseline as Record<string, Ceiling>;
/** Steps whose screens are all at the budget. A ceiling above it must name a later step. */
const FINISHED: Ceiling['target'][] = ['E1'];
const NOW = '2026-10-28T12:00:00Z';
const copyOf = (locale: Locale) => locale === 'pl' ? pl : en;
const accountId = '10000000-0000-4000-8000-000000000001';
const oathId = '20000000-0000-4000-8000-000000000001';
const otherOathId = '20000000-0000-4000-8000-000000000002';
const characterId = '30000000-0000-4000-8000-000000000001';
const submissionId = '40000000-0000-4000-8000-000000000001';
const mira: Character = { id: characterId, name: 'Mira', presetId: 'starter_02', build: 'thin', form: 'feminine', createdAt: '2026-09-26T12:00:00Z' };
const bor: Character = { id: '30000000-0000-4000-8000-00000000000b', name: 'Bor', presetId: 'starter_01', build: 'heavy', form: 'masculine', createdAt: '2026-09-26T12:00:00Z' };

// D is 2026-10-29 02:30 in Warsaw (01:30 UTC), S is 15 minutes later. Away from the summer time change, so no offset is drawn.
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog)); snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-28T02:00:00', timezone: 'Europe/Warsaw', offset: '+01:00', explicitOffset: false, utc: '2026-10-28T01:00:00Z' } };
  snapshot.deadline = { local: '2026-10-29T02:30:00', timezone: 'Europe/Warsaw', offset: '+01:00', explicitOffset: false, utc: '2026-10-29T01:30:00Z', receiptCutoff: '2026-10-29T01:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { id: oathId, characterId, snapshot, state: 'active', createdAt: '2026-10-28T01:00:00Z', activatedAt: '2026-10-28T01:00:00Z', terminalAt: null, reason: null, review: null, proof: null, ...patch };
}
const receipt = { submissionId, mode: 'photo' as const, revision: 1, receivedAt: '2026-10-28T18:14:00Z', assessment: 'queued' as const };
const record = (id = oathId) => ({ version: 1 as const, accountId, characterId, oathId: id, submissionId, mode: 'photo' as const, fileName: `${submissionId}.jpg` });
function scheduledOath() {
  const item = oath({ state: 'scheduled', activatedAt: null });
  item.snapshot = { ...item.snapshot, activation: { mode: 'scheduled', time: { local: '2026-10-28T20:00:00', timezone: 'Europe/Warsaw', offset: '+01:00', explicitOffset: false, utc: '2026-10-28T19:00:00Z' } } };
  return item;
}

/** Oath lists and detail as OathHomeScreen's own tests fake them. The clock reads `serverTime`, so time-bound states are exact. */
function homeController(today: Oath[], history: Oath[], serverTime: string, paused = false) {
  const state: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  const clock = createServerClock(); clock.observe(serverTime);
  const page = (items: Oath[]) => ({ kind: 'success' as const, value: { items, nextCursor: null, total: items.length, serverTime, paused, characterId } });
  return {
    clock, getState: () => state, subscribe: () => () => {},
    list: jest.fn(async (query: { view: 'today' | 'history' }) => page(query.view === 'history' ? history : today)),
    detail: jest.fn(async (id: string) => ({ kind: 'success', value: { oath: [...today, ...history].find(item => item.id === id), serverTime } })),
    getPause: jest.fn(), pause: jest.fn(), resetCreation: jest.fn(), recover: jest.fn(), refresh: jest.fn(),
  } as unknown as OathController;
}
function proofController(state: ProofControllerState = { kind: 'ready', busy: false, pending: null, oath: null }) {
  return { getState: () => state, subscribe: () => () => {}, submit: jest.fn(async () => {}), recover: jest.fn(async () => {}), discard: jest.fn(async () => {}), dismissRefusal: jest.fn() } as unknown as ProofController;
}

async function home(locale: Locale, today: Oath[], history: Oath[] = [], serverTime = NOW, proof?: ProofControllerState) {
  await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen controller={homeController(today, history, serverTime)} proof={proofController(proof)} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByTestId('forge-seal').catch(() => screen.findByRole('button', { name: copyOf(locale).oathHome.history }));
}
/** Opens the detail of the only Oath from its seal on the wall. */
async function detail(locale: Locale, item: Oath, serverTime = NOW, proof?: ProofControllerState) {
  await home(locale, [item], [], serverTime, proof);
  await fireEvent.press(screen.getByTestId('forge-seal'));
  await screen.findByTestId('detail-status');
}

function oathScreenController() {
  const snapshot = oath().snapshot;
  const envelope = { preview: { id: oathId, snapshot: { ...snapshot, activation: { mode: 'now', time: null } } }, characterId, serverTime: NOW };
  const session = { subscribe: () => () => {}, getToken: () => 'A'.repeat(43), getState: () => ({ kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' } }), reauthenticate: jest.fn() } as unknown as SessionController;
  const storage: PendingStorage = { read: jest.fn().mockResolvedValue({ kind: 'success', value: null }), write: jest.fn().mockResolvedValue({ kind: 'success' }) };
  const confirmed = { oath: { id: oathId, characterId, snapshot, state: 'active', createdAt: NOW, activatedAt: NOW, terminalAt: null, reason: null, review: null, proof: null }, serverTime: NOW };
  const api = {
    preview: jest.fn().mockResolvedValue({ kind: 'success', value: envelope }),
    getPreview: jest.fn().mockResolvedValue({ kind: 'success', value: { preview: envelope.preview, characterId, oathId: null } }),
    confirm: jest.fn().mockResolvedValue({ kind: 'success', value: confirmed }),
  } as unknown as OathClient;
  const controller = createOathController({ session, api, storage }); controller.setCharacter({ accountId, characterId });
  disposers.push(() => controller.dispose());
  return controller;
}
const disposers: (() => void)[] = [];
const filledDraft: OathCreationDraft = { activity: 'running', scheduled: false, activation: { date: '', time: '', zone: 'Europe/Warsaw' }, deadline: { date: '2026-10-29', time: '02:30:00', zone: 'Europe/Warsaw' } };
const guideStorage = (seen: boolean): GuideStorage => ({ read: jest.fn().mockResolvedValue(seen), markSeen: jest.fn().mockResolvedValue(undefined) });
async function oathScreen(locale: Locale, draft: OathCreationDraft | null, seen = true) {
  const controller = oathScreenController(); controller.start();
  await render(<LocalizationProvider initialLocale={locale}><OathScreen controller={controller} timezone="Europe/Warsaw" initialDraft={draft} rulesGuideStorage={guideStorage(seen)} onBack={jest.fn()} backLabel={copyOf(locale).forge.returnRoom} onViewOath={jest.fn()} /></LocalizationProvider>);
}
async function review(locale: Locale, seen: boolean) {
  await oathScreen(locale, filledDraft, seen);
  await fireEvent.press(screen.getByRole('button', { name: copyOf(locale).oath.viewRules }));
  await screen.findByRole('button', { name: copyOf(locale).oath.confirm });
}

async function proof(locale: Locale, serverTime: string, state?: ProofControllerState) {
  const clock = createServerClock(); clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale={locale}><ProofScreen oath={oath()} controller={proofController(state)} clock={clock} onDone={jest.fn()} onBack={jest.fn()} backLabel={copyOf(locale).proof.back} /></LocalizationProvider>);
}

const progress = (today: number, history: number) => ({ today: { total: today, paused: false }, history: { total: history }, loading: false });
async function room(locale: Locale, props: Partial<Parameters<typeof ForgeRoom>[0]> = {}) {
  await render(<LocalizationProvider initialLocale={locale}><ForgeRoom character={mira} progress={progress(1, 1)} onTalk={jest.fn()} onExit={jest.fn()} onOpenStation={jest.fn()} {...props} /></LocalizationProvider>);
}
async function place(locale: Locale, name: 'hearth' | 'seals' | 'chronicle' | 'door') {
  await room(locale);
  await fireEvent.press(screen.getByRole('button', { name: copyOf(locale).room[name] }));
}

const onboardingReady = (profile: Partial<Extract<OnboardingViewProps['state'], { kind: 'ready' }>['value']['profile']>): OnboardingViewProps['state'] => ({
  kind: 'ready', busy: false,
  value: { profile: { locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: true, notificationPreference: null, ...profile }, onboardingStatus: 'pending' },
  draft: { locale: 'pl', timezone: 'Europe/Warsaw', intention: false },
});
async function onboarding(locale: Locale, state: OnboardingViewProps['state'], permission: 'not_determined' | 'granted' = 'not_determined') {
  const notifications = { state: { permission: { kind: permission, canAskAgain: true }, busy: false }, onEnable: jest.fn(), onSkip: jest.fn(), onRetryPermission: jest.fn(), onSettings: jest.fn() };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={state} notifications={notifications} onDraft={jest.fn()} onSave={jest.fn()} onIntroduce={jest.fn()} onComplete={jest.fn()} onRetry={jest.fn()} onLogout={jest.fn()} /></LocalizationProvider>);
}

type CharactersReady = Extract<CharacterControllerState, { kind: 'ready' }>;
const characters = (patch: Partial<CharactersReady> = {}): CharactersReady => ({ kind: 'ready', characters: [], activeCharacterId: null, presets: ['starter_01', 'starter_02', 'starter_03', 'starter_04'], limit: 3, busy: false, pendingCreation: null, activeRevision: 1, ...patch });
/** The first character offers sign-out, a later one the way back to the character screens (AuthScreen). */
function Creation({ state, another = false }: { state: CharacterControllerState; another?: boolean }) {
  const [draft, setDraft] = useState<CharacterCreationDraft>(emptyCreationDraft);
  return <CharacterCreationScreen state={state} draft={draft} onDraft={patch => setDraft(value => ({ ...value, ...patch }))} onCreate={jest.fn()} onRetry={jest.fn()} onReload={jest.fn()}
    {...(another ? { onCancel: jest.fn() } : { onSignOut: jest.fn() })} />;
}

async function settings(locale: Locale, paused: boolean) {
  await render(<LocalizationProvider initialLocale={locale}><SettingsScreen locale={locale} localeState={{ saving: false, error: false }}
    notificationState={{ permission: { kind: 'granted', canAskAgain: true }, busy: false }} preference="enabled" character={{ name: 'Mira' }} paused={paused}
    onLocale={jest.fn()} onNotifications={jest.fn()} onRetryPermission={jest.fn()} onOpenSystemSettings={jest.fn()} onPause={jest.fn()} onSignOut={jest.fn()} onBack={jest.fn()} /></LocalizationProvider>);
}
async function pauseReview(locale: Locale, paused: boolean) {
  const controller = homeController([oath()], [], NOW, paused);
  jest.mocked(controller.getPause).mockResolvedValue({ kind: 'success', value: { paused, revision: 'a'.repeat(64), withdraw: paused ? [] : [oathId], preserve: [], serverTime: NOW, characterId } });
  await render(<LocalizationProvider initialLocale={locale}><PauseReviewScreen controller={controller} character={mira} onBack={jest.fn()} onChanged={jest.fn()} /></LocalizationProvider>);
  await screen.findByRole('button', { name: copyOf(locale).oathHome[paused ? 'resume' : 'confirmPause'] });
}

/** Every named screen state of the engagement spec E1 table that exists today. The proof hand-over comes with E6. */
const states: Record<string, (locale: Locale) => Promise<unknown>> = {
  'menu': locale => render(<LocalizationProvider initialLocale={locale}><MainMenuScreen character={mira} summary={{ kind: 'ready', total: 2, paused: false, characterId }} pending={false}
    onForge={jest.fn()} onTutorial={jest.fn()} onSettings={jest.fn()} onChangeCharacter={jest.fn()} /></LocalizationProvider>),
  'settings': locale => settings(locale, false),
  'settings.paused': locale => settings(locale, true),
  'pauseReview.pause': locale => pauseReview(locale, false),
  'pauseReview.resume': locale => pauseReview(locale, true),
  'signIn': locale => render(<LocalizationProvider initialLocale={locale}><AuthView state={{ kind: 'signed_out' }} availability="available" onLogin={jest.fn()} onRetry={jest.fn()} onLogout={jest.fn()} /></LocalizationProvider>),
  'onboarding.basics': locale => onboarding(locale, { ...onboardingReady({ locale: null, timezone: null, intention: null, companionIntroduced: false }) }),
  'onboarding.companion': locale => onboarding(locale, onboardingReady({ companionIntroduced: false })),
  'onboarding.notifications': locale => onboarding(locale, onboardingReady({})),
  'onboarding.reviewOn': locale => onboarding(locale, onboardingReady({ notificationPreference: 'enabled' }), 'granted'),
  'onboarding.reviewOff': locale => onboarding(locale, onboardingReady({ notificationPreference: 'disabled' }), 'granted'),
  'characterCreation': locale => render(<LocalizationProvider initialLocale={locale}><Creation state={characters()} /></LocalizationProvider>),
  'characterCreation.another': locale => render(<LocalizationProvider initialLocale={locale}><Creation state={characters({ characters: [mira], activeCharacterId: mira.id })} another /></LocalizationProvider>),
  // A stored creation the Forge has not answered yet, with no error: the pending note is not an error, so it counts.
  'characterCreation.pending': locale => render(<LocalizationProvider initialLocale={locale}><Creation state={characters({ pendingCreation: { version: 2, accountId, requestId: '50000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'starter_02', build: 'thin', form: 'feminine' } })} /></LocalizationProvider>),
  'changeCharacter': locale => render(<LocalizationProvider initialLocale={locale}><ChangeCharacterScreen state={characters({ characters: [mira, bor], activeCharacterId: mira.id })} onChoose={jest.fn()} onNew={jest.fn()} onBack={jest.fn()} /></LocalizationProvider>),
  'oathForm': locale => oathScreen(locale, null),
  'oathForm.scheduled': async locale => {
    await oathScreen(locale, null);
    await fireEvent.press(screen.getByRole('radio', { name: copyOf(locale).oath.scheduled }));
  },
  'review': locale => review(locale, true),
  'review.firstGuide': locale => review(locale, false),
  'confirmation': async locale => {
    await review(locale, true);
    await fireEvent.press(screen.getByRole('button', { name: copyOf(locale).oath.confirm }));
    await screen.findByText(copyOf(locale).oath.made);
  },
  'today': locale => home(locale, [oath()]),
  'history': async locale => {
    await home(locale, [], [oath({ state: 'fulfilled', terminalAt: '2026-10-28T21:30:00Z', proof: receipt })]);
    await fireEvent.press(screen.getByRole('button', { name: copyOf(locale).oathHome.history }));
    await screen.findByRole('button', { name: /^(Otwórz Przysięgę|Open Oath)/ });
  },
  'detail.scheduled': locale => detail(locale, scheduledOath()),
  'detail.active': locale => detail(locale, oath()),
  'detail.activeLastHour': locale => detail(locale, oath(), '2026-10-29T01:10:00Z'),
  'detail.cutoff': locale => detail(locale, oath(), '2026-10-29T01:35:00Z'),
  'detail.afterCutoff': locale => detail(locale, oath(), '2026-10-29T01:50:00Z'),
  'detail.interrupted': locale => detail(locale, oath(), NOW, { kind: 'ready', busy: false, pending: record(), oath: null }),
  'detail.proof_pending': locale => detail(locale, oath({ state: 'proof_pending', proof: receipt })),
  'detail.needs_more_evidence': locale => detail(locale, oath({ state: 'needs_more_evidence', proof: receipt })),
  'detail.review_pending': locale => detail(locale, oath({ state: 'review_pending', reason: 'service_availability_unknown', review: { enteredAt: '2026-10-29T01:45:01Z', closesAt: '2026-11-01T01:45:01Z' } }), '2026-10-30T00:00:00Z'),
  'detail.fulfilled': locale => detail(locale, oath({ state: 'fulfilled', terminalAt: '2026-10-28T21:30:00Z', proof: receipt }), '2026-10-30T00:00:00Z'),
  'detail.missed': locale => detail(locale, oath({ state: 'missed', terminalAt: '2026-10-29T01:45:00Z' }), '2026-10-30T00:00:00Z'),
  'detail.unresolved': locale => detail(locale, oath({ state: 'unresolved', terminalAt: '2026-11-01T01:45:01Z', review: { enteredAt: '2026-10-29T01:45:01Z', closesAt: '2026-11-01T01:45:01Z' } }), '2026-11-02T00:00:00Z'),
  'detail.withdrawn': locale => detail(locale, oath({ state: 'withdrawn', reason: 'character_paused', terminalAt: '2026-10-28T15:00:00Z' }), '2026-10-30T00:00:00Z'),
  'proof.form': locale => proof(locale, NOW),
  'proof.cutoff': locale => proof(locale, '2026-10-29T01:35:00Z'),
  'proof.windowClosed': locale => proof(locale, '2026-10-29T01:46:00Z'),
  'proof.pending': locale => proof(locale, NOW, { kind: 'ready', busy: false, pending: record(), oath: null }),
  'proof.sending': locale => proof(locale, NOW, { kind: 'ready', busy: true, pending: record(), oath: null }),
  'proof.otherPending': locale => proof(locale, NOW, { kind: 'ready', busy: false, pending: record(otherOathId), oath: null }),
  'room': locale => room(locale),
  'room.firstEntry': locale => room(locale, { progress: progress(0, 0), showGuide: true }),
  'room.hearth': locale => place(locale, 'hearth'),
  'room.seals': locale => place(locale, 'seals'),
  'room.chronicle': locale => place(locale, 'chronicle'),
  'room.door': locale => place(locale, 'door'),
  'room.talk': async locale => {
    await room(locale);
    await fireEvent.press(screen.getByRole('button', { name: copyOf(locale).room.talk.label }));
  },
  'room.tutorial': locale => room(locale, { tutorial: 1 }),
  'room.tutorialChapter': async locale => {
    await room(locale, { tutorial: 1 });
    const copy = copyOf(locale).room;
    await fireEvent.press(screen.getByRole('button', { name: copy.tutorial.hear.replace('{{place}}', copy.hearth) }));
    await fireEvent.press(screen.getByRole('button', { name: copy.tutorial.next }));
  },
  'tutorialScreen': locale => render(<LocalizationProvider initialLocale={locale}><TutorialScreen onBack={jest.fn()} /></LocalizationProvider>),
};

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse(NOW) });
  // Motion off: steps stay open on the proof screen and the dialogue panel shows its whole line.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const viewport = { width: 402, height: 874, scale: 3, fontScale: 1 };
  Dimensions.set({ window: viewport, screen: viewport });
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); jest.restoreAllMocks(); jest.useRealTimers(); });
/** Lets art gates (at most 600 ms, MVP-22 G35), loads and announcements settle without moving a countdown to its next unit. */
const settle = () => act(async () => { jest.advanceTimersByTime(700); });

describe('screen word budget', () => {
  test.each(Object.keys(states).flatMap(name => (['pl', 'en'] as const).map(locale => [name, locale] as const)))('%s in %s stays at its ceiling', async (name, locale) => {
    await states[name](locale);
    await settle();
    const problem = ratchetProblem(name, locale, visibleWords(screen.root!), ceilings[name]);
    if (problem) throw new Error(problem);
  });

  test('every ceiling belongs to a measured state', () => {
    expect(Object.keys(ceilings).filter(name => !(name in states))).toEqual([]);
  });

  test('a ceiling above the budget names a step that has not finished', () => {
    const steps = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
    const over = Object.entries(ceilings).filter(([, ceiling]) => Math.max(ceiling.pl, ceiling.en) > WORD_BUDGET);
    expect(over.filter(([, ceiling]) => !steps.includes(ceiling.target) || FINISHED.includes(ceiling.target))).toEqual([]);
  });

  // E1.4 acceptance: an error after the player's own action is exempt and still replaces the step's line.
  test.each(['pl', 'en'] as const)('a %s onboarding error replaces the line and costs nothing', async locale => {
    const copy = copyOf(locale).onboarding;
    const basics = onboardingReady({ locale: null, timezone: null, intention: null, companionIntroduced: false });
    await onboarding(locale, { ...basics, error: 'save' } as OnboardingViewProps['state']);
    await settle();
    expect(screen.getByText(copy.error_save)).toHaveProp('accessibilityRole', 'alert');
    expect(screen.queryByText(copy.unconfirmed)).toBeNull();
    expect(visibleWords(screen.root!).count).toBe(ceilings['onboarding.basics'][locale] - words(copy.unconfirmed).length);
  });

  test('one added word fails the ratchet and names the screen and the word', async () => {
    await render(<View><Text>Zobacz Przysięgę</Text></View>);
    const ceiling: Ceiling = { pl: visibleWords(screen.root!).count, en: 0, target: 'E1' };
    await render(<View><Text>Zobacz Przysięgę</Text><Text>teraz</Text></View>);
    expect(ratchetProblem('confirmation', 'pl', visibleWords(screen.root!), ceiling)).toBe('word budget: confirmation pl measured 3, ceiling 2. Words: Zobacz Przysięgę teraz');
  });

  test('a lower count asks to lower the ceiling', () => {
    expect(ratchetProblem('menu', 'en', { count: 20, words: [] }, { pl: 22, en: 22, target: 'E1' })).toBe('word budget: menu en measured 20, ceiling 22. Lower the ceiling to 20.');
    expect(ratchetProblem('menu', 'en', { count: 22, words: [] }, { pl: 22, en: 22, target: 'E1' })).toBeNull();
  });
});
