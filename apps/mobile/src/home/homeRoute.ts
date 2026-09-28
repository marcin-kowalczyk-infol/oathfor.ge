import type { LayoutMode } from '../ui/layoutMode';
import type { ForgeStation as Station } from '../forge/ForgeRoom';
export type HomeOrigin = 'menu' | 'settings';
export type OathTarget = 'create' | 'today' | 'history';
// tutorial and request ids grow with each tap, so a screen can tell a new request from one it already handled.
// flown marks a request the room already flew into, so the screen does not zoom again. from is the place a return flies out of.
export type HomeRoute =
  | { kind: 'menu' } | { kind: 'settings' } | { kind: 'pause' } | { kind: 'tutorial' }
  | { kind: 'forge'; tutorial: number | null; from?: Station }
  | { kind: 'oaths'; request: { id: number; target: OathTarget; flown?: boolean } }
  | { kind: 'change' | 'create'; origin: HomeOrigin };
export type HomeState = { accountId: string; characterId: string; route: HomeRoute; sequence: number };
export type HomeAction =
  | { type: 'openForge'; layout: LayoutMode; pending: boolean }
  | { type: 'openTutorial'; layout: LayoutMode }
  | { type: 'back'; layout: LayoutMode }
  | { type: 'openSettings' | 'openChange' | 'openCreate' | 'openPause' | 'door' | 'tutorialEnded' }
  | { type: 'openStation'; station: Station; flown?: boolean };
const stationTarget: Record<Station, OathTarget> = { hearth: 'create', seals: 'today', chronicle: 'history' };
const targetStation: Record<OathTarget, Station> = { create: 'hearth', today: 'seals', history: 'chronicle' };
export const initialHome = (accountId: string, characterId: string, sequence = 0): HomeState => ({ accountId, characterId, route: { kind: 'menu' }, sequence });
// Every route belongs to one account and character. Any other pair starts from the menu.
// The room is not interactive in simple layout, so it gives way to the menu there.
export function resolveHome(state: HomeState | null, accountId: string, characterId: string, layout: LayoutMode): HomeState {
  if (state?.accountId !== accountId || state.characterId !== characterId) return initialHome(accountId, characterId, state?.sequence);
  return layout === 'simple' && state.route.kind === 'forge' ? { ...state, route: { kind: 'menu' } } : state;
}
const origin = (route: HomeRoute): HomeOrigin => route.kind === 'settings' ? 'settings' : route.kind === 'change' || route.kind === 'create' ? route.origin : 'menu';
function back(route: HomeRoute, layout: LayoutMode): HomeRoute {
  switch (route.kind) {
    case 'pause': return { kind: 'settings' };
    case 'change': return { kind: route.origin };
    case 'create': return { kind: 'change', origin: route.origin };
    case 'oaths': return layout !== 'room' ? { kind: 'menu' }
      : route.request.flown ? { kind: 'forge', tutorial: null, from: targetStation[route.request.target] } : { kind: 'forge', tutorial: null };
    default: return { kind: 'menu' };
  }
}
export function homeReducer(state: HomeState, action: HomeAction): HomeState {
  const next = state.sequence + 1;
  const oaths = (target: OathTarget, flown = false): HomeState => ({ ...state, route: { kind: 'oaths', request: flown ? { id: next, target, flown } : { id: next, target } }, sequence: next });
  const to = (route: HomeRoute): HomeState => ({ ...state, route });
  switch (action.type) {
    // An interrupted acceptance is resumed before anything else in the Forge.
    case 'openForge': return action.pending ? oaths('create') : action.layout === 'room' ? to({ kind: 'forge', tutorial: null }) : oaths('today');
    // The room tells the tutorial as a conversation. Simple layout shows the same chapters as text.
    case 'openTutorial': return action.layout === 'room' ? { ...state, route: { kind: 'forge', tutorial: next }, sequence: next } : to({ kind: 'tutorial' });
    case 'openSettings': return to({ kind: 'settings' });
    case 'openPause': return to({ kind: 'pause' });
    case 'openChange': return to({ kind: 'change', origin: origin(state.route) });
    case 'openCreate': return to({ kind: 'create', origin: origin(state.route) });
    case 'openStation': return state.route.kind === 'forge' ? oaths(stationTarget[action.station], action.flown) : state;
    case 'door': return state.route.kind === 'forge' ? to({ kind: 'menu' }) : state;
    // A remounted room must not start a tutorial the player already closed.
    case 'tutorialEnded': return state.route.kind === 'forge' && state.route.tutorial !== null ? to({ kind: 'forge', tutorial: null }) : state;
    case 'back': return to(back(state.route, action.layout));
  }
}
