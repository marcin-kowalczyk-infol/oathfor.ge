import type { LayoutMode } from '../ui/layoutMode';
export type HomeOrigin = 'menu' | 'settings';
export type OathTarget = 'create' | 'today' | 'history';
export type Station = 'hearth' | 'seals' | 'chronicle';
// guide and request ids grow with each tap, so a screen can tell a new request from one it already handled.
export type HomeRoute =
  | { kind: 'menu' } | { kind: 'settings' } | { kind: 'pause' }
  | { kind: 'forge'; guide: number | null }
  | { kind: 'oaths'; request: { id: number; target: OathTarget } }
  | { kind: 'change' | 'create'; origin: HomeOrigin };
export type HomeState = { accountId: string; characterId: string; route: HomeRoute; sequence: number };
export type HomeAction =
  | { type: 'openForge'; layout: LayoutMode; pending: boolean }
  | { type: 'back'; layout: LayoutMode }
  | { type: 'openTutorial' | 'openSettings' | 'openChange' | 'openCreate' | 'openPause' | 'door' }
  | { type: 'openStation'; station: Station };
const stationTarget: Record<Station, OathTarget> = { hearth: 'create', seals: 'today', chronicle: 'history' };
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
    case 'oaths': return layout === 'room' ? { kind: 'forge', guide: null } : { kind: 'menu' };
    default: return { kind: 'menu' };
  }
}
export function homeReducer(state: HomeState, action: HomeAction): HomeState {
  const next = state.sequence + 1;
  const oaths = (target: OathTarget): HomeState => ({ ...state, route: { kind: 'oaths', request: { id: next, target } }, sequence: next });
  const to = (route: HomeRoute): HomeState => ({ ...state, route });
  switch (action.type) {
    // An interrupted acceptance is resumed before anything else in the Forge.
    case 'openForge': return action.pending ? oaths('create') : action.layout === 'room' ? to({ kind: 'forge', guide: null }) : oaths('today');
    case 'openTutorial': return { ...state, route: { kind: 'forge', guide: next }, sequence: next };
    case 'openSettings': return to({ kind: 'settings' });
    case 'openPause': return to({ kind: 'pause' });
    case 'openChange': return to({ kind: 'change', origin: origin(state.route) });
    case 'openCreate': return to({ kind: 'create', origin: origin(state.route) });
    case 'openStation': return state.route.kind === 'forge' ? oaths(stationTarget[action.station]) : state;
    case 'door': return state.route.kind === 'forge' ? to({ kind: 'menu' }) : state;
    case 'back': return to(back(state.route, action.layout));
  }
}
