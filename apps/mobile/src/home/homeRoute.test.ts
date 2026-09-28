import { homeReducer, initialHome, resolveHome, type HomeAction, type HomeState } from './homeRoute';
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const X = '30000000-0000-4000-8000-00000000000a';
const Y = '30000000-0000-4000-8000-00000000000b';
const run = (...actions: HomeAction[]) => actions.reduce(homeReducer, initialHome(A, X));
test('initial state for an account and character is the menu', () => {
  expect(initialHome(A, X)).toMatchObject({ accountId: A, characterId: X, route: { kind: 'menu' } });
});
test('entering the Forge opens the room, or the Today list in simple layout', () => {
  expect(run({ type: 'openForge', layout: 'room', pending: false }).route).toEqual({ kind: 'forge', tutorial: null });
  expect(run({ type: 'openForge', layout: 'simple', pending: false }).route).toEqual({ kind: 'oaths', request: { id: 1, target: 'today' } });
});
test('a pending acceptance makes the Forge resume Oath creation in either layout', () => {
  expect(run({ type: 'openForge', layout: 'room', pending: true }).route).toEqual({ kind: 'oaths', request: { id: 1, target: 'create' } });
  expect(run({ type: 'openForge', layout: 'simple', pending: true }).route).toEqual({ kind: 'oaths', request: { id: 1, target: 'create' } });
});
test('menu tiles open the room tutorial, Settings and the change screen', () => {
  const tutorial = run({ type: 'openTutorial', layout: 'room' });
  expect(tutorial.route).toEqual({ kind: 'forge', tutorial: 1 });
  expect(homeReducer(homeReducer(tutorial, { type: 'door' }), { type: 'openTutorial', layout: 'room' }).route).toEqual({ kind: 'forge', tutorial: 2 });
  expect(run({ type: 'openSettings' }).route).toEqual({ kind: 'settings' });
  expect(run({ type: 'openChange' }).route).toEqual({ kind: 'change', origin: 'menu' });
});
test('change and create return along their origin', () => {
  const change = run({ type: 'openSettings' }, { type: 'openChange' });
  expect(change.route).toEqual({ kind: 'change', origin: 'settings' });
  expect(homeReducer(change, { type: 'back', layout: 'room' }).route).toEqual({ kind: 'settings' });
  expect(run({ type: 'openChange' }, { type: 'back', layout: 'room' }).route).toEqual({ kind: 'menu' });
  const create = homeReducer(change, { type: 'openCreate' });
  expect(create.route).toEqual({ kind: 'create', origin: 'settings' });
  expect(homeReducer(create, { type: 'back', layout: 'room' }).route).toEqual({ kind: 'change', origin: 'settings' });
  expect(run({ type: 'openCreate' }).route).toEqual({ kind: 'create', origin: 'menu' });
});
test('pause returns to Settings and Settings returns to the menu', () => {
  const pause = run({ type: 'openSettings' }, { type: 'openPause' });
  expect(pause.route).toEqual({ kind: 'pause' });
  const settings = homeReducer(pause, { type: 'back', layout: 'room' });
  expect(settings.route).toEqual({ kind: 'settings' });
  expect(homeReducer(settings, { type: 'back', layout: 'room' }).route).toEqual({ kind: 'menu' });
});
test('room stations open Oath screens with fresh requests and the door returns to the menu', () => {
  const forge = run({ type: 'openForge', layout: 'room', pending: false });
  expect(homeReducer(forge, { type: 'door' }).route).toEqual({ kind: 'menu' });
  expect(homeReducer(forge, { type: 'openStation', station: 'seals' }).route).toEqual({ kind: 'oaths', request: { id: 1, target: 'today' } });
  expect(homeReducer(forge, { type: 'openStation', station: 'hearth' }).route).toEqual({ kind: 'oaths', request: { id: 1, target: 'create' } });
  const history = homeReducer(forge, { type: 'openStation', station: 'chronicle' });
  expect(history.route).toEqual({ kind: 'oaths', request: { id: 1, target: 'history' } });
  const again = homeReducer(homeReducer(history, { type: 'back', layout: 'room' }), { type: 'openStation', station: 'chronicle' });
  expect(again.route).toEqual({ kind: 'oaths', request: { id: 2, target: 'history' } });
});
test('back from the Oath screens returns to the room, or to the menu in simple layout', () => {
  const oaths = run({ type: 'openForge', layout: 'room', pending: false }, { type: 'openStation', station: 'seals' });
  expect(homeReducer(oaths, { type: 'back', layout: 'room' }).route).toEqual({ kind: 'forge', tutorial: null });
  expect(homeReducer(oaths, { type: 'back', layout: 'simple' }).route).toEqual({ kind: 'menu' });
});
test('the room ignores a station action outside the room and the menu stays on back', () => {
  expect(run({ type: 'openStation', station: 'seals' }).route).toEqual({ kind: 'menu' });
  expect(run({ type: 'back', layout: 'room' }).route).toEqual({ kind: 'menu' });
});
test('a stored state resolves to the menu for another account or character', () => {
  const stored: HomeState = run({ type: 'openSettings' }, { type: 'openPause' });
  expect(resolveHome(stored, A, X, 'room')).toBe(stored);
  expect(resolveHome(stored, B, X, 'room')).toMatchObject({ accountId: B, characterId: X, route: { kind: 'menu' } });
  expect(resolveHome(stored, A, Y, 'room')).toMatchObject({ accountId: A, characterId: Y, route: { kind: 'menu' } });
  expect(resolveHome(null, A, X, 'room')).toEqual(initialHome(A, X));
});
test('request ids keep growing across a character change', () => {
  const before = run({ type: 'openForge', layout: 'simple', pending: false }, { type: 'back', layout: 'simple' }, { type: 'openForge', layout: 'simple', pending: false });
  const after = homeReducer(resolveHome(before, A, Y, 'simple'), { type: 'openForge', layout: 'simple', pending: false });
  expect(after.route).toEqual({ kind: 'oaths', request: { id: before.sequence + 1, target: 'today' } });
});
test('the room gives way to the menu when the layout becomes simple', () => {
  const forge = run({ type: 'openForge', layout: 'room', pending: false });
  expect(resolveHome(forge, A, X, 'simple').route).toEqual({ kind: 'menu' });
  expect(resolveHome(forge, A, X, 'room')).toBe(forge);
});
test('only the room has the door to the menu', () => {
  const oaths = run({ type: 'openForge', layout: 'room', pending: false }, { type: 'openStation', station: 'seals' });
  expect(homeReducer(oaths, { type: 'door' })).toBe(oaths);
  expect(run({ type: 'openSettings' }, { type: 'door' }).route).toEqual({ kind: 'settings' });
});
test('simple layout tutorial opens the tutorial screen and back returns to the menu', () => {
  const tutorial = run({ type: 'openTutorial', layout: 'simple' });
  expect(tutorial.route).toEqual({ kind: 'tutorial' });
  expect(homeReducer(tutorial, { type: 'back', layout: 'simple' }).route).toEqual({ kind: 'menu' });
  expect(homeReducer(tutorial, { type: 'door' })).toBe(tutorial);
});
test('the tutorial screen stays when the layout becomes the room', () => {
  const tutorial = run({ type: 'openTutorial', layout: 'simple' });
  expect(resolveHome(tutorial, A, X, 'room')).toBe(tutorial);
});
test('an ended room tutorial clears its id so a remount does not start it again', () => {
  const tutorial = run({ type: 'openTutorial', layout: 'room' });
  expect(homeReducer(tutorial, { type: 'tutorialEnded' }).route).toEqual({ kind: 'forge', tutorial: null });
  const settings = run({ type: 'openSettings' });
  expect(homeReducer(settings, { type: 'tutorialEnded' })).toBe(settings);
});
test('a flown station request skips the screen zoom and the way back flies out of that place', () => {
  const oaths = run({ type: 'openForge', layout: 'room', pending: false }, { type: 'openStation', station: 'seals', flown: true });
  expect(oaths.route).toMatchObject({ kind: 'oaths', request: { target: 'today', flown: true } });
  expect(homeReducer(oaths, { type: 'back', layout: 'room' }).route).toEqual({ kind: 'forge', tutorial: null, from: 'seals' });
  // A request that did not fly, for example an interrupted acceptance, returns to the room as before.
  const resumed = run({ type: 'openForge', layout: 'room', pending: true });
  expect(homeReducer(resumed, { type: 'back', layout: 'room' }).route).toEqual({ kind: 'forge', tutorial: null });
});
