import { useEffect, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Character } from '../api/characters';
import type { Profile } from '../api/profile';
import { ChangeCharacterScreen } from '../characters/ChangeCharacterScreen';
import type { CharacterController, CharacterControllerState } from '../characters/controller';
import { ForgeRoom } from '../forge/ForgeRoom';
import { useForgeProgress } from '../forge/useForgeProgress';
import type { GuideStorage } from '../forge/guideStorage';
import type { NetworkEvents } from '../api/networkEvents';
import type { ArtStyle } from '../art/registry';
import { useTranslation } from '../localization/LocalizationProvider';
import { resolveLocale, type Locale } from '../localization/locale';
import type { NotificationState } from '../onboarding/notifications';
import type { OathController } from '../oaths/controller';
import type { ProofController } from '../proof/proofController';
import { OathHomeScreen } from '../oaths/OathHomeScreen';
import { PauseReviewScreen } from '../settings/PauseReviewScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { layoutMode } from '../ui/layoutMode';
import { MotionSuspended } from '../ui/useMotion';
import { homeReducer, resolveHome, type HomeAction, type HomeState } from './homeRoute';
import { MainMenuScreen } from './MainMenuScreen';
import { TutorialScreen } from './TutorialScreen';
import { useOathSummary } from './useOathSummary';

type Ready = Extract<CharacterControllerState, { kind: 'ready' }>;
const GUIDE_READ_LIMIT = 1500;
export type HomeRoutesProps = {
  accountId: string;
  character: Character;
  characterState: Ready;
  characters: Pick<CharacterController, 'switch' | 'clearError'>;
  /** Bound to this account and character before the routes mount. */
  oaths: OathController;
  /** The shell's one proof controller, following the same account and character. */
  proof?: ProofController;
  profile: Profile;
  timezone: string;
  guideStorage: GuideStorage;
  rulesGuideStorage?: GuideStorage;
  /** Reconnects reload the visible Oath list. */
  network?: NetworkEvents;
  /** The demo's art style choice for Settings. Absent in production. */
  artStyle?: { value: ArtStyle; onChange(style: ArtStyle): void };
  notifications: { state: NotificationState; enable(): void; skip(): void; retryPermission(): void; settings(): void };
  /**
   * Route state owned by the parent for the account, so a session check that hides these screens returns to the same place.
   * resolveHome gives the menu for another account or character.
   */
  home: HomeState | null;
  onHome: Dispatch<SetStateAction<HomeState | null>>;
  /** The parent's language attempt, which outlives these screens. */
  language: { saving: boolean; error: boolean };
  onLocale(locale: Locale): void;
  /** Settings opened again: an old error is cleared, a save still running stays visible. */
  onSettingsOpened(): void;
  renderCreation(onCancel: () => void): ReactNode;
  onSignOut(): void;
};

/**
 * Everything after a character exists: the menu, the Forge room, the tutorial screen, Settings, the pause review and the character screens.
 * Mounted only while the Oath controller serves this account and character.
 * Only the visible screen is mounted, except the Oath screens, which stay mounted and hidden so their tab, drafts and handled room requests survive.
 */
export function HomeRoutes(props: HomeRoutesProps) {
  const { accountId, character, oaths, guideStorage } = props;
  const { i18n } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const layout = layoutMode(width, fontScale);
  const setStored = props.onHome;
  const home = resolveHome(props.home, accountId, character.id, layout);
  const route = home.route;
  // An error belongs to the screen that caused it, for example a failed switch never shows up in creation.
  const dispatch = (action: HomeAction) => {
    props.characters.clearError();
    setStored(current => homeReducer(resolveHome(current, accountId, character.id, layout), action));
  };
  const back = () => dispatch({ type: 'back', layout });

  const oathState = useSyncExternalStore(oaths.subscribe, oaths.getState);
  const pending = oathState.kind === 'ready' && oathState.pending !== null;
  const confirmedId = oathState.kind === 'ready' ? oathState.oath?.id : undefined;
  const summary = useOathSummary(oaths);
  const { refresh } = summary;
  // The hook loads once on mount, while the menu is the first route. Every later entry loads again.
  const menuVisible = route.kind === 'menu';
  const onMenu = useRef(true);
  useEffect(() => {
    if (menuVisible && !onMenu.current) refresh();
    onMenu.current = menuVisible;
  }, [menuVisible, refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') refresh(); });
    return () => subscription.remove();
  }, [refresh]);
  useEffect(() => { if (confirmedId) refresh(); }, [confirmedId, refresh]);
  const current = summary.state.kind === 'ready' && summary.state.characterId === character.id ? summary.state : null;

  // The Oath screens reload their list after a pause change made in Settings.
  const [oathReload, setOathReload] = useState(0);

  // The guide flag is read on the first room entry. The room waits for it, so the guide never flashes or starts late.
  // A read without an answer counts as unseen after GUIDE_READ_LIMIT. Showing the guide again is the safe loss.
  const [guideSeen, setGuideSeen] = useState<boolean | null>(null);
  const inRoom = route.kind === 'forge';
  // Żaromir's statistics load on each room entry and again when he is touched.
  const forgeProgress = useForgeProgress(oaths, character.id);
  const refreshProgress = forgeProgress.refresh;
  useEffect(() => { if (inRoom) refreshProgress(); }, [inRoom, refreshProgress]);
  useEffect(() => {
    if (!inRoom || guideSeen !== null) return;
    let live = true;
    const settle = (seen: boolean) => { if (live) { live = false; setGuideSeen(seen); } };
    const limit = setTimeout(() => settle(false), GUIDE_READ_LIMIT);
    guideStorage.read(accountId).then(settle, () => settle(false));
    return () => { live = false; clearTimeout(limit); };
  }, [inRoom, guideSeen, guideStorage, accountId]);
  function guideDone() {
    setGuideSeen(true);
    void guideStorage.markSeen(accountId);
  }

  // The review names its character, so it shows only while the Oath controller serves that same character. Otherwise Settings shows again.
  const bound = oaths.boundCharacter();
  const pauseOwned = bound?.accountId === accountId && bound.characterId === character.id;
  const strayPause = route.kind === 'pause' && !pauseOwned;
  useEffect(() => { if (strayPause) back(); }, [strayPause]);

  let front: ReactNode = null;
  switch (route.kind) {
    case 'menu':
      front = <MainMenuScreen character={character} summary={current ?? (summary.state.kind === 'failed' ? summary.state : { kind: 'loading' })} pending={pending}
        onForge={() => dispatch({ type: 'openForge', layout, pending })} onTutorial={() => dispatch({ type: 'openTutorial', layout })}
        onSettings={() => { props.onSettingsOpened(); dispatch({ type: 'openSettings' }); }} onChangeCharacter={() => dispatch({ type: 'openChange' })} />;
      break;
    case 'forge':
      front = guideSeen === null ? <View testID="forge-room-waiting" style={styles.dark} />
        // A tutorial started before the first room entry replaces the guide, which then counts as seen.
        : <ForgeRoom character={character} progress={forgeProgress.progress} onTalk={refreshProgress} from={route.from} onReturned={() => dispatch({ type: 'returned' })} showGuide={!guideSeen} onGuideComplete={guideDone} tutorial={route.tutorial} onTutorialStart={() => { if (!guideSeen) guideDone(); }} onTutorialEnd={() => dispatch({ type: 'tutorialEnded' })}
          onOpenStation={station => dispatch({ type: 'openStation', station, flown: true })} onExit={() => dispatch({ type: 'door' })} />;
      break;
    case 'tutorial':
      front = <TutorialScreen onBack={back} />;
      break;
    case 'settings': {
      const { notifications } = props;
      front = <SettingsScreen locale={props.profile.locale ?? resolveLocale(i18n.resolvedLanguage ?? i18n.language)} localeState={props.language}
        notificationState={notifications.state} preference={props.profile.notificationPreference} character={character} paused={current ? current.paused : null} artStyle={props.artStyle}
        onLocale={props.onLocale} onNotifications={enabled => { if (enabled) notifications.enable(); else notifications.skip(); }}
        onRetryPermission={notifications.retryPermission} onOpenSystemSettings={notifications.settings}
        onPause={() => dispatch({ type: 'openPause' })} onSignOut={props.onSignOut} onBack={back} />;
      break;
    }
    case 'pause':
      front = pauseOwned ? <PauseReviewScreen key={`${accountId}.${character.id}`} controller={oaths} character={character} onBack={back}
        onChanged={() => { refresh(); setOathReload(value => value + 1); back(); }} /> : null;
      break;
    case 'change':
      front = <ChangeCharacterScreen state={props.characterState} onChoose={id => { void props.characters.switch(id); }} onNew={() => dispatch({ type: 'openCreate' })} onBack={back} />;
      break;
    case 'create':
      front = props.renderCreation(back);
      break;
  }
  const hidden = route.kind !== 'oaths';
  // Keyed by character, so lists reload and Oath drafts start fresh after a switch.
  return <>
    {front && <View style={styles.fill}>{front}</View>}
    <View style={hidden ? styles.hidden : styles.fill} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
      <MotionSuspended suspended={hidden}>
        <OathHomeScreen key={`${accountId}.${character.id}`} controller={oaths} proof={props.proof} timezone={props.timezone} rulesGuideStorage={props.rulesGuideStorage} network={props.network} reload={oathReload}
          forgeNavigation={{ request: route.kind === 'oaths' ? route.request : null, onReturn: place => dispatch({ type: 'back', layout, from: place }) }} />
      </MotionSuspended>
    </View>
  </>;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, hidden: { display: 'none' }, dark: { flex: 1, backgroundColor: '#0d0b09' } });
