import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';
import { tokens } from '../ui/tokens';
import * as Picker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Oath } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { ProofController, ProofControllerState } from './proofController';
import { ProofScreen } from './ProofScreen';
import { createProofController } from './proofController';
import { AppState } from 'react-native';
import { createServerClock } from '../oaths/serverClock';
import type { SessionController } from '../auth/session';
import type { ProofFiles } from './proofFiles';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(), PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));
// Deleting a local file is recorded, so tests can check that no picked or normalized copy is left behind.
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation((uri: string) => ({ uri, get exists() { return !mockDeleted.includes(uri); }, delete: () => { mockDeleted.push(uri); } })) }));
const mockDeleted: string[] = [];
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } }));

const oathId = '20000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-000000000001';
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog)); snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { id: oathId, characterId, snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof: null, ...patch };
}
function fakeController(initial: ProofControllerState = { kind: 'ready', busy: false, pending: null, oath: null }) {
  let state = initial;
  const listeners = new Set<() => void>();
  const controller = {
    getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    submit: jest.fn(async () => {}), recover: jest.fn(async () => {}), discard: jest.fn(async () => {}),
  } as unknown as ProofController;
  return { controller, change(next: ProofControllerState) { state = next; listeners.forEach(fn => fn()); } };
}
const normalized = 'file:///cache/ImageManipulator/normalized.jpg';
let rendered = { width: 2880, height: 2160 };
const context = { resize: jest.fn(), renderAsync: jest.fn(), release: jest.fn() };
const saveAsync = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  // Steps stay open under Reduce Motion. The fold tests turn it off (MVP-22-T12c).
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  mockDeleted.splice(0);
  rendered = { width: 2880, height: 2160 };
  context.resize.mockImplementation(() => context);
  context.renderAsync.mockImplementation(async () => ({ ...rendered, saveAsync, release: jest.fn() }));
  saveAsync.mockImplementation(async () => ({ uri: normalized, ...rendered }));
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
  jest.mocked(Picker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///picked/IMG_0001.heic', width: 4032, height: 3024 }] } as never);
  jest.mocked(Picker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///camera/IMG_0002.jpg', width: 4032, height: 3024 }] } as never);
  jest.mocked(Picker.requestCameraPermissionsAsync).mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' } as never);
});
const size = (width: number, fontScale: number) => Dimensions.set({ window: { width, height: 874, scale: 3, fontScale }, screen: { width, height: 874, scale: 3, fontScale } });
afterEach(() => size(402, 1));

async function show(locale: 'pl' | 'en' = 'pl', value = oath(), f = fakeController(), clock?: ReturnType<typeof createServerClock>) {
  const onDone = jest.fn(); const onBack = jest.fn();
  await render(<LocalizationProvider initialLocale={locale}><ProofScreen oath={value} controller={f.controller} clock={clock} onDone={onDone} onBack={onBack} backLabel={locale === 'pl' ? 'Wróć' : 'Back'} /></LocalizationProvider>);
  return { ...f, onDone, onBack };
}

test('without the declaration the send action is disabled with an accessible hint', async () => {
  size(402, 1);
  const f = await show();
  await fireEvent.press(screen.getByRole('radio', { name: /Zdjęcie kontekstu/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  expect(await screen.findByLabelText('Wybrany obraz')).toBeOnTheScreen();
  const send = screen.getByRole('button', { name: 'Prześlij dowód' });
  expect(send).toBeDisabled();
  expect(send).toHaveProp('accessibilityHint', 'Potwierdź deklarację ukończenia.');
  await fireEvent.press(send);
  expect(f.controller.submit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('checkbox', { name: /Tak, potwierdzam/ }));
  expect(screen.getByRole('checkbox', { name: /Tak, potwierdzam/ })).toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Prześlij dowód' }));
  expect(f.controller.submit).toHaveBeenCalledWith({ oathId, mode: 'photo', source: normalized });
});

async function pickFromLibrary(route: RegExp = /Zdjęcie kontekstu/) {
  await fireEvent.press(screen.getByRole('radio', { name: route }));
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  await screen.findByLabelText('Wybrany obraz');
}
async function readyToSend(route?: RegExp) {
  await pickFromLibrary(route);
  await fireEvent.press(screen.getByRole('checkbox', { name: /Tak, potwierdzam/ }));
}

test('a 4032 × 3024 pick is resized to a 2880 long edge and saved as JPEG 0.85, without EXIF or in-app editing', async () => {
  const f = await show();
  await readyToSend(/Zapis aktywności/);
  for (const launch of [Picker.launchImageLibraryAsync]) {
    const options = jest.mocked(launch).mock.calls[0][0]!;
    expect(options).toMatchObject({ mediaTypes: ['images'] });
    expect(options.exif).not.toBe(true);
    expect(options.allowsEditing).not.toBe(true);
  }
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///picked/IMG_0001.heic');
  expect(context.resize).toHaveBeenCalledWith({ width: 2880 });
  expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
  expect(screen.getByLabelText('Wybrany obraz')).toHaveProp('source', { uri: normalized });
  await fireEvent.press(screen.getByRole('button', { name: 'Prześlij dowód' }));
  expect(f.controller.submit).toHaveBeenCalledWith({ oathId, mode: 'activity_record', source: normalized });
});

test('a denied camera shows its message and the library still gives an image', async () => {
  jest.mocked(Picker.requestCameraPermissionsAsync).mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false, expires: 'never' } as never);
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Zrób zdjęcie' }));
  expect(await screen.findByText('Aplikacja nie ma dostępu do aparatu. Możesz go włączyć w Ustawieniach albo wybrać obraz ze Zdjęć.')).toBeOnTheScreen();
  expect(Picker.launchCameraAsync).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Otwórz Ustawienia' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  expect(await screen.findByLabelText('Wybrany obraz')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' })).toBeEnabled();
});

// Side by side the notice goes under the pair, so it never stretches one button of the row. Stacked, it stays under its own button.
test.each([[402, 1, false], [340, 1, true]] as const)('at %i pt and text scale %d a denied camera notice sits inside the sources: %s', async (width, fontScale, inside) => {
  size(width, fontScale);
  jest.mocked(Picker.requestCameraPermissionsAsync).mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false, expires: 'never' } as never);
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Zrób zdjęcie' }));
  expect(await screen.findByTestId('proof-notice-camera')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Otwórz Ustawienia' })).toBeOnTheScreen();
  expect(within(screen.getByTestId('proof-sources')).queryByTestId('proof-notice-camera') !== null).toBe(inside);
});

test('a granted camera takes the photo with the same options, a camera that cannot open leaves the library usable', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Zrób zdjęcie' }));
  expect(await screen.findByLabelText('Wybrany obraz')).toBeOnTheScreen();
  const options = jest.mocked(Picker.launchCameraAsync).mock.calls[0][0]!;
  expect(options).toMatchObject({ mediaTypes: ['images'] });
  expect(options.exif).not.toBe(true);
  expect(options.allowsEditing).not.toBe(true);
  jest.mocked(Picker.launchCameraAsync).mockRejectedValueOnce(new Error('Camera not available on simulator'));
  await fireEvent.press(screen.getByRole('button', { name: 'Zrób zdjęcie' }));
  expect(await screen.findByText('Nie udało się otworzyć aparatu. Wybierz obraz ze Zdjęć albo spróbuj ponownie.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' })).toBeEnabled();
});

test('a library that cannot open or a cancelled pick never shows a preview', async () => {
  jest.mocked(Picker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: true, assets: null } as never).mockRejectedValueOnce(new Error('no picker'));
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  await waitFor(() => expect(Picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  expect(screen.queryByLabelText('Wybrany obraz')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  expect(await screen.findByText('Nie udało się otworzyć Zdjęć. Zrób zdjęcie aparatem albo spróbuj ponownie.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Wybrany obraz')).toBeNull();
  expect(screen.getByRole('button', { name: 'Zrób zdjęcie' })).toBeEnabled();
});

test('an image the manipulator cannot prepare asks for another one', async () => {
  context.renderAsync.mockRejectedValueOnce(new Error('decode failed'));
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  expect(await screen.findByText('Nie udało się przygotować obrazu. Wybierz go ponownie.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Wybrany obraz')).toBeNull();
});

test.each(['scheduled', 'proof_pending', 'fulfilled', 'missed', 'review_pending'] as const)('a %s Oath offers no send action', async state => {
  await show('pl', oath({ state, ...(state === 'scheduled' ? { activatedAt: null } : {}), ...(['fulfilled', 'missed'].includes(state) ? { terminalAt: '2026-10-25T01:00:00Z' } : {}) }));
  expect(screen.getByText('Ta Przysięga nie przyjmuje teraz dowodu.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Prześlij dowód' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Wybierz ze Zdjęć' })).toBeNull();
});

// 375 and 402 pt are the room layout, 340 pt and text scale 1.4 the simple one. Native wrapping is checked in T11.
test.each([['pl', 375, 1, 'row'], ['en', 402, 1, 'row'], ['pl', 340, 1, 'column'], ['en', 402, 1.4, 'column']] as const)('%s at %i pt and text scale %d shows the routes, the declaration and the caveats from the catalogs', async (locale, width, fontScale, direction) => {
  size(width, fontScale);
  const value = oath();
  await show(locale, value);
  const pl = locale === 'pl';
  expect(screen.getByText(pl ? 'Zdjęcie kontekstu' : 'Context photo')).toBeOnTheScreen();
  expect(screen.getByText(pl ? 'Zapis aktywności' : 'Activity record')).toBeOnTheScreen();
  // MVP-22-T11: the declaration, the privacy line and the AI line stay visible. The committed rules, the crop note and the caveat are moved behind links, never deleted.
  expect(screen.getByText(value.snapshot.copy[locale].declaration)).toBeOnTheScreen();
  expect(screen.getByText(pl ? 'Prywatne fragmenty zasłoń w Zdjęciach, zanim wybierzesz obraz.' : 'Cover anything private in Photos before you choose an image.')).toBeOnTheScreen();
  expect(screen.getByText(pl ? 'AI ocenia tylko to, co widać na obrazie.' : 'AI assesses only what the image shows.')).toBeOnTheScreen();
  const caveat = pl ? 'Obraz nie pokaże ukończenia, czasu trwania ani osoby na treningu, dlatego Kuźnia opiera się też na Twojej deklaracji.'
    : 'An image cannot show that you finished, how long you trained or who trained, so the Forge also relies on your declaration.';
  const crop = pl ? /Prywatne fragmenty przytnij lub zasłoń wcześniej w Zdjęciach/ : /Crop or cover anything private in Photos first/;
  expect(screen.queryByText(value.snapshot.copy[locale].sections.photo)).toBeNull();
  expect(screen.queryByText(caveat)).toBeNull();
  expect(screen.queryByText(crop)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: pl ? 'Zasady dowodu' : 'Proof rules' }));
  expect(screen.getByText(value.snapshot.copy[locale].sections.photo)).toBeOnTheScreen();
  expect(screen.getByText(value.snapshot.copy[locale].sections.activityRecord)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: pl ? 'Jak ukryć szczegóły' : 'How to hide details' }));
  expect(screen.getByText(crop)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: pl ? 'O ocenie dowodu' : 'About the assessment' }));
  expect(screen.getByText(caveat)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: pl ? 'Prześlij dowód' : 'Submit proof' })).toHaveProp('accessibilityHint', pl ? 'Wybierz rodzaj dowodu.' : 'Choose the proof type.');
  expect(screen.getByTestId('proof-sources')).toHaveStyle({ flexDirection: direction });
});

test('sending shows no success until the server answers, then hands back the returned Oath', async () => {
  const f = await show();
  await readyToSend();
  await fireEvent.press(screen.getByRole('button', { name: 'Prześlij dowód' }));
  const pending = { version: 1 as const, accountId: '10000000-0000-4000-8000-000000000001', characterId, oathId, submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo' as const, fileName: '40000000-0000-4000-8000-000000000001.jpg' };
  await act(async () => f.change({ kind: 'ready', busy: true, pending, oath: null }));
  expect(screen.getByText('Dowód w drodze. Stan Przysięgi zmieni się dopiero, gdy serwer odpowie.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Wyślij ponownie' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Usuń kopię z tego urządzenia' })).toBeNull();
  expect(f.onDone).not.toHaveBeenCalled();
  const received = oath({ state: 'proof_pending', proof: { submissionId: pending.submissionId, mode: 'photo', revision: 1, receivedAt: '2026-10-24T18:14:00Z', assessment: 'queued' } });
  await act(async () => f.change({ kind: 'ready', busy: false, pending: null, oath: received }));
  expect(f.onDone).toHaveBeenCalledTimes(1);
  expect(f.onDone).toHaveBeenCalledWith(received);
});

test('an unreachable server keeps the copy with send-again and discard, and claims no receipt', async () => {
  const pending = { version: 1 as const, accountId: '10000000-0000-4000-8000-000000000001', characterId, oathId, submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo' as const, fileName: '40000000-0000-4000-8000-000000000001.jpg' };
  const f = await show('en', oath(), fakeController({ kind: 'ready', busy: false, pending, oath: null, error: { kind: 'unavailable', retry: 'request' } }));
  expect(screen.getByText('We could not reach the server. The proof has not been received yet. A copy is waiting on this device.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Submit proof' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Send again' }));
  expect(f.controller.recover).toHaveBeenCalledTimes(1);
  await act(async () => f.change({ kind: 'ready', busy: false, pending, oath: null, error: { kind: 'upload_rejected', code: 'image_required' } }));
  expect(screen.getByText('The server did not receive the image. Send it again, or delete the copy on this device and choose a new image.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete the copy on this device' }));
  expect(f.controller.discard).toHaveBeenCalledTimes(1);
  expect(f.onDone).not.toHaveBeenCalled();
  // Deleting is local. It never reads as a send.
  await act(async () => f.change({ kind: 'ready', busy: true, pending, oath: null, deleting: true }));
  expect(screen.getByText('Deleting the proof copy…')).toBeOnTheScreen();
  expect(screen.queryByText(/^Sending your proof/)).toBeNull();
});

test.each([
  [{ kind: 'proof_refused', code: 'receipt_cutoff_passed' }, 'The proof window has closed, so the server did not accept this proof. Go back to the Oath to see its state.', true],
  [{ kind: 'proof_refused', code: 'oath_not_active', state: 'review_pending' }, 'This Oath is no longer waiting for proof. Check its current status.', true],
  [{ kind: 'too_large' }, 'This image is too large to send. Choose another one.', false],
  [{ kind: 'file_missing' }, 'The saved copy of the image is no longer on this device. Choose the image again.', false],
  [{ kind: 'proof_refused', code: 'unreadable_image', field: 'image' }, 'The server could not read this image. Choose another one.', false],
  [{ kind: 'reauthenticate' }, 'Sign in again. The proof copy is waiting on this device.', false],
] as const)('a new %j answer reads clearly', async (error, message, closes) => {
  const f = await show('en');
  await fireEvent.press(screen.getByRole('radio', { name: /Context photo/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose from Photos' }));
  await screen.findByLabelText('Chosen image');
  await fireEvent.press(screen.getByRole('checkbox', { name: /Yes, I confirm/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Submit proof' }));
  await act(async () => f.change({ kind: 'ready', busy: false, pending: null, oath: null, error: error as ProofControllerState extends infer S ? S extends { error?: infer E } ? E : never : never }));
  expect(screen.getByText(message)).toBeOnTheScreen();
  if (closes) {
    expect(screen.queryByRole('button', { name: 'Submit proof' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the Oath' }));
    expect(f.onBack).toHaveBeenCalled();
  } else if (error.kind !== 'reauthenticate') expect(screen.queryByLabelText('Chosen image')).toBeNull();
  expect(f.onDone).not.toHaveBeenCalled();
});

test('an answer left over from an earlier proof is not shown on a new form', async () => {
  await show('en', oath(), fakeController({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'too_large' } }));
  expect(screen.queryByText('This image is too large to send. Choose another one.')).toBeNull();
});

const pendingFor = (id: string, submission = '40000000-0000-4000-8000-000000000001') => ({ version: 1 as const, accountId: '10000000-0000-4000-8000-000000000001', characterId, oathId: id, submissionId: submission, mode: 'photo' as const, fileName: `${submission}.jpg` });
const otherOathId = '20000000-0000-4000-8000-000000000002';

test('a proof waiting for another Oath can be sent again from here, but only its own Oath offers delete', async () => {
  const f = await show('en', oath(), fakeController({ kind: 'ready', busy: false, pending: pendingFor(otherOathId), oath: null, error: { kind: 'unavailable', retry: 'request' } }));
  expect(screen.getByText('Proof for another Oath is waiting on this device. Send it first so you can submit proof here.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Delete the copy on this device' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Send again' }));
  expect(f.controller.recover).toHaveBeenCalledTimes(1);
  expect(f.controller.discard).not.toHaveBeenCalled();
  // Its answers stay off this form: the other Oath's receipt does not finish this screen.
  await act(async () => f.change({ kind: 'ready', busy: false, pending: null, oath: oath({ id: otherOathId, state: 'proof_pending', proof: { submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo', revision: 1, receivedAt: '2026-10-24T18:14:00Z', assessment: 'queued' } }) }));
  expect(f.onDone).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Submit proof' })).toBeOnTheScreen();
});

test("another Oath's receipt or refusal does not close this form, clear its image or finish it", async () => {
  const f = await show('en');
  await fireEvent.press(screen.getByRole('radio', { name: /Context photo/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose from Photos' }));
  await screen.findByLabelText('Chosen image');
  // A proof for another Oath, resumed in the background, resolves while this form is open.
  await act(async () => f.change({ kind: 'ready', busy: true, pending: pendingFor(otherOathId), oath: null }));
  await act(async () => f.change({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'proof_refused', code: 'receipt_cutoff_passed' } }));
  expect(screen.queryByText('The proof window has closed, so the server did not accept this proof. Go back to the Oath to see its state.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Submit proof' })).toBeOnTheScreen();
  await act(async () => f.change({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'proof_refused', code: 'unreadable_image', field: 'image' } }));
  expect(screen.getByLabelText('Chosen image')).toBeOnTheScreen();
  await act(async () => f.change({ kind: 'ready', busy: false, pending: null, oath: oath({ id: otherOathId, state: 'proof_pending', proof: { submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo', revision: 1, receivedAt: '2026-10-24T18:14:00Z', assessment: 'queued' } }) }));
  expect(f.onDone).not.toHaveBeenCalled();
});

test('VoiceOver reads each route rule as the hint of its choice', async () => {
  const value = oath();
  await show('en', value);
  expect(screen.getByRole('radio', { name: /Context photo/ })).toHaveProp('accessibilityHint', value.snapshot.copy.en.sections.photo);
  expect(screen.getByRole('radio', { name: /Activity record/ })).toHaveProp('accessibilityHint', value.snapshot.copy.en.sections.activityRecord);
});

test('after an effect re-run, as in StrictMode or Fast Refresh, a chosen image still arrives', async () => {
  await render(<StrictMode><LocalizationProvider initialLocale="pl"><ProofScreen oath={oath()} controller={fakeController().controller} onDone={jest.fn()} onBack={jest.fn()} backLabel="Wróć" /></LocalizationProvider></StrictMode>);
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  expect(await screen.findByLabelText('Wybrany obraz')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' })).toBeEnabled();
});

test('iCloud photos are downloaded, and no picked or normalized copy is left in the cache', async () => {
  const second = 'file:///cache/ImageManipulator/second.jpg';
  const view = await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  await screen.findByLabelText('Wybrany obraz');
  expect(jest.mocked(Picker.launchImageLibraryAsync).mock.calls[0][0]).toMatchObject({ shouldDownloadFromNetwork: true });
  expect(mockDeleted).toEqual(['file:///picked/IMG_0001.heic']);
  saveAsync.mockImplementationOnce(async () => ({ uri: second, ...rendered }));
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  await waitFor(() => expect(screen.getByLabelText('Wybrany obraz')).toHaveProp('source', { uri: second }));
  expect(mockDeleted).toContain(normalized);
  // Once the controller holds its own copy for this Oath, the screen's copy goes.
  await act(async () => view.change({ kind: 'ready', busy: true, pending: pendingFor(oathId), oath: null }));
  expect(mockDeleted).toContain(second);
});

test('leaving the screen deletes its normalized copy', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
  await screen.findByLabelText('Wybrany obraz');
  await act(async () => screen.unmount());
  expect(mockDeleted).toContain(normalized);
});

test.each([
  [{ kind: 'proof_error', code: 'character_required' }, 'Choose a character to continue. The proof copy is waiting on this device.'],
  [{ kind: 'proof_error', code: 'not_found' }, 'This Oath belongs to a character that is not active now. The proof copy is waiting on this device.'],
  [{ kind: 'rate_limited', retry: 'request', retryAfterSeconds: 30 }, 'Too many attempts. Wait a moment and try again. A copy is waiting on this device.'],
] as const)('a kept proof with %j explains what to do', async (error, message) => {
  await show('en', oath(), fakeController({ kind: 'ready', busy: false, pending: pendingFor(oathId), oath: null, error: error as never }));
  expect(within(screen.getByTestId('proof-pending')).getByText(message)).toBeOnTheScreen();
});

// The real controller copies the normalized image in a queued step after submit returns control. Leaving the screen at that
// moment must not delete the source before the copy has read it.
test('leaving the screen while a send waits for its copy keeps the image until the controller has it', async () => {
  const accountId = '10000000-0000-4000-8000-000000000001';
  const session = { getState: () => ({ kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }), getToken: () => 'A'.repeat(43),
    subscribe: () => () => {}, reauthenticate: jest.fn() } as unknown as SessionController;
  let releaseCopy!: () => void;
  const gate = new Promise<void>(resolve => { releaseCopy = resolve; });
  const copied: { source: string; existed: boolean }[] = [];
  const files: ProofFiles = {
    copy: jest.fn(async (_owner, source: string) => { await gate; copied.push({ source, existed: !mockDeleted.includes(source) }); return mockDeleted.includes(source) ? { kind: 'unavailable' as const } : { kind: 'success' as const }; }),
    open: jest.fn(async () => ({ kind: 'success' as const, file: { uri: 'file:///cache/proofs/x.jpg' } as never })),
    remove: jest.fn(async () => ({ kind: 'success' as const })), sweep: jest.fn(async () => ({ kind: 'success' as const })),
  };
  const storage = { read: jest.fn(async () => ({ kind: 'success' as const, value: null })), write: jest.fn(async () => ({ kind: 'success' as const })) };
  const api = { submit: jest.fn(async () => ({ kind: 'unavailable', retry: 'request' })) } as never as { submit: jest.Mock };
  const controller = createProofController({ session, api: api as never, storage, files, createId: () => '40000000-0000-4000-8000-0000000000aa' });
  controller.setCharacter({ accountId, characterId });
  controller.start();
  await waitFor(() => expect(controller.getState().kind).toBe('ready'));
  await render(<LocalizationProvider initialLocale="pl"><ProofScreen oath={oath()} controller={controller} onDone={jest.fn()} onBack={jest.fn()} backLabel="Wróć" /></LocalizationProvider>);
  await readyToSend();
  await fireEvent.press(screen.getByRole('button', { name: 'Prześlij dowód' }));
  await act(async () => screen.unmount());
  expect(mockDeleted).not.toContain(normalized);
  await act(async () => { releaseCopy(); });
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(1));
  expect(copied).toEqual([{ source: normalized, existed: true }]);
  // Once the send has settled, the screen's copy goes.
  await waitFor(() => expect(mockDeleted).toContain(normalized));
  controller.dispose();
});

// MVP-22-T11: the proof screen in three steps (docs/product/clarity.md decision 12).
const filled = () => screen.queryAllByText('◆', { includeHiddenElements: true });
const clockAt = (iso: string) => { const clock = createServerClock(); clock.observe(iso); return clock; };
// Motion counts only in the foreground, and the jest AppState has no current state, so the fold tests bring the app forward.
function foreground() { const previous = AppState.currentState; AppState.currentState = 'active'; return () => { AppState.currentState = previous; }; }
/** The system allows motion, so finished steps fold. */
function motion() { jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false); }

test('the top shows the compact step badge and Żaromir, the full introduction waits behind the assessment link', async () => {
  await show('pl', oath(), fakeController(), clockAt('2026-10-24T12:00:00Z'));
  expect(screen.getByLabelText('Etap 2 z 4, Trening, Aktywna')).toBeOnTheScreen();
  expect(screen.queryAllByTestId(/^step-node-/, { includeHiddenElements: true })).toHaveLength(0);
  expect(screen.getByLabelText(/^Żaromir: /)).toBeOnTheScreen();
  for (const title of ['Rodzaj dowodu', 'Obraz', 'Potwierdzenie']) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  const full = 'Wybierz rodzaj dowodu, dodaj jeden obraz i potwierdź ukończenie treningu. Przysięga zmieni stan dopiero, gdy serwer odbierze dowód.';
  expect(screen.queryByText(full)).toBeNull();
  // MVP-22-T12c (P2): no intro link at the top. The introduction opens with the assessment note.
  expect(screen.queryByRole('button', { name: 'Pełny opis' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'O ocenie dowodu' }));
  expect(screen.getByText(full)).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
});

// MVP-22-T12c: native polish of the proof screen.
test('the proof screen stands on a solid background, never on the seal wall artwork', async () => {
  await show('pl');
  expect(screen.queryByTestId('forge-place-seals', { includeHiddenElements: true })).toBeNull();
  expect(StyleSheet.flatten(screen.getByTestId('proof-screen').props.style)).toMatchObject({ flex: 1, backgroundColor: tokens.color.canvas });
});

test('step 3 shows the stored declaration once and a short checkbox that speaks it', async () => {
  const value = oath();
  await show('pl', value);
  expect(screen.queryByText('Wymagane potwierdzenie ukończenia')).toBeNull();
  expect(screen.getByText(value.snapshot.copy.pl.declaration)).toBeOnTheScreen();
  const box = screen.getByRole('checkbox', { name: /Tak, potwierdzam/ });
  expect(within(box).getByText('Tak, potwierdzam')).toBeOnTheScreen();
  expect(box.props.accessibilityLabel).toContain(value.snapshot.copy.pl.declaration);
});

test('the English checkbox reads "Yes, I confirm" with the declaration', async () => {
  const value = oath();
  await show('en', value);
  const box = screen.getByRole('checkbox', { name: /Yes, I confirm/ });
  expect(within(box).getByText('Yes, I confirm')).toBeOnTheScreen();
  expect(box.props.accessibilityLabel).toContain(value.snapshot.copy.en.declaration);
});

test('between the deadline and the cutoff Żaromir keeps the conditional cutoff line', async () => {
  await show('pl', oath(), fakeController(), clockAt('2026-10-25T00:35:00Z'));
  const line = screen.getByLabelText(/^Żaromir: /).props.accessibilityLabel.replace('Żaromir: ', '');
  expect(['Okno na dowód otwarte. Prześlij go, jeśli trening skończył się w terminie.', 'Jeśli trening skończył się w terminie, dowód może jeszcze zdążyć.',
    'Świeca jeszcze płonie. Jeśli trening zakończył się w terminie, prześlij dowód teraz.']).toContain(line);
});

test('a chosen type and a chosen image fold to one-line summaries that "Zmień" reopens', async () => {
  const restore = foreground(); motion();
  try {
    await show('pl');
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press(screen.getByRole('radio', { name: /Zdjęcie kontekstu/ }));
    expect(screen.queryByRole('radio', { name: /Zapis aktywności/ })).toBeNull();
    expect(screen.getByText('✓ Zdjęcie kontekstu')).toBeOnTheScreen();
    expect(screen.getByText('✓ Zdjęcie kontekstu')).not.toHaveProp('numberOfLines');
    await fireEvent.press(screen.getByRole('button', { name: 'Zmień: Rodzaj dowodu' }));
    expect(screen.getByRole('radio', { name: /Zapis aktywności/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: /Zapis aktywności/ }));
    expect(screen.getByText('✓ Zapis aktywności')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
    expect(await screen.findByLabelText('Wybrany obraz')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Wybierz ze Zdjęć' })).toBeNull();
    expect(screen.queryByText('Prywatne fragmenty zasłoń w Zdjęciach, zanim wybierzesz obraz.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Zmień: Obraz' }));
    expect(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' })).toBeOnTheScreen();
  } finally { restore(); }
});

// MVP-22 G31: in drawn text a middle-dot separator never ends a line (clarity.md, MVP-22-G24b). The summary row wraps at large
// text, so the dot and "Zmień" form one unbreakable item and a wrap moves the dot down with "Zmień".
test('a summary keeps its dot with "Zmień", so a wrap never ends a line on the dot', async () => {
  size(402, 1);
  const restore = foreground(); motion();
  try {
    await show('pl');
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press(screen.getByRole('radio', { name: /Zdjęcie kontekstu/ }));
    const change = screen.getByRole('button', { name: 'Zmień: Rodzaj dowodu' });
    const tail = screen.getByTestId('summary-change');
    expect(within(tail).getByText('·')).toBeOnTheScreen();
    expect(within(tail).getByRole('button', { name: 'Zmień: Rodzaj dowodu' })).toBe(change);
    expect(within(tail).queryByText('✓ Zdjęcie kontekstu')).toBeNull();
    const tailStyle = StyleSheet.flatten(tail.props.style) as Record<string, unknown>;
    expect(tailStyle.flexDirection).toBe('row');
    expect(tailStyle.flexWrap ?? 'nowrap').toBe('nowrap');
    // The row around it still wraps, and "Zmień" keeps its 44 pt touch.
    expect((StyleSheet.flatten(tail.parent!.props.style) as Record<string, unknown>).flexWrap).toBe('wrap');
    expect((StyleSheet.flatten(change.props.style) as Record<string, unknown>).minHeight).toBe(44);
  } finally { restore(); }
});

test.each([['simple layout', 340], ['Reduce Motion', 402]] as const)('in the %s every step stays open after a choice', async (_, width) => {
  size(width, 1);
  // Both cases run in the foreground. The simple layout allows motion, Reduce Motion is on (the default of this file).
  const restore = foreground();
  if (width === 340) motion();
  try {
    await show('pl');
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press(screen.getByRole('radio', { name: /Zdjęcie kontekstu/ }));
    expect(screen.getByRole('radio', { name: /Zapis aktywności/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' }));
    await screen.findByLabelText('Wybrany obraz');
    expect(screen.getByRole('button', { name: 'Wybierz ze Zdjęć' })).toBeOnTheScreen();
  } finally { restore(); }
});

test('while the proof is sent the button is busy and Żaromir is absent', async () => {
  const f = await show('pl', oath(), fakeController(), clockAt('2026-10-24T12:00:00Z'));
  await readyToSend();
  await act(async () => f.change({ kind: 'ready', busy: true, pending: null, oath: null }));
  expect(screen.getByRole('button', { name: 'Prześlij dowód' })).toHaveProp('accessibilityState', expect.objectContaining({ busy: true }));
  expect(screen.queryByLabelText(/^Żaromir: /)).toBeNull();
  expect(screen.getByText('Dowód w drodze. Stan Przysięgi zmieni się dopiero, gdy serwer odpowie.')).toBeOnTheScreen();
  expect(screen.queryByTestId('zaromir-bust', { includeHiddenElements: true })).toBeNull();
});

test.each([
  ['own', pendingFor(oathId), 'proof-pending', 'Dowód zapisany na tym urządzeniu czeka na wysłanie. Serwer go jeszcze nie odebrał.', 'Etap 2 z 4, Trening, Nie dotarł'],
  ['other', pendingFor(otherOathId), 'proof-other-pending', 'Na tym urządzeniu czeka dowód innej Przysięgi. Wyślij go teraz, aby móc przesłać dowód tutaj.', 'Etap 2 z 4, Trening, Aktywna'],
] as const)('a waiting %s copy shows one card line, one filled resend and an outline secondary', async (_, pending, testID, line, badge) => {
  await show('pl', oath(), fakeController({ kind: 'ready', busy: false, pending, oath: null }));
  const card = screen.getByTestId(testID);
  expect(within(card).getByText(line)).toBeOnTheScreen();
  expect(screen.getByLabelText(badge)).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
  expect(within(screen.getByRole('button', { name: 'Wyślij ponownie' })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
});

test('a closed window shows one card line and one filled way back', async () => {
  const f = await show('en');
  await fireEvent.press(screen.getByRole('radio', { name: /Context photo/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose from Photos' }));
  await screen.findByLabelText('Chosen image');
  await fireEvent.press(screen.getByRole('checkbox', { name: /Yes, I confirm/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Submit proof' }));
  await act(async () => f.change({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'proof_refused', code: 'receipt_cutoff_passed' } }));
  expect(within(screen.getByTestId('proof-closed')).getByText('The proof window has closed, so the server did not accept this proof. Go back to the Oath to see its state.')).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
  expect(screen.queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
});

// MVP-22-T12c: review findings on T11.
test('the proof rules stay reachable after the type step folds', async () => {
  const restore = foreground(); motion();
  try {
    await show('pl');
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press(screen.getByRole('radio', { name: /Zdjęcie kontekstu/ }));
    expect(screen.getByText('✓ Zdjęcie kontekstu')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Zasady dowodu' }));
    expect(screen.getByText(oath().snapshot.copy.pl.sections.photo)).toBeOnTheScreen();
  } finally { restore(); }
});

test('a system alert that sends the app to the background does not unfold the finished steps', async () => {
  const listeners: ((state: string) => void)[] = [];
  const original = jest.mocked(AppState.addEventListener).getMockImplementation();
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => { listeners.push(listener); return { remove: jest.fn() }; }) as never);
  const restore = foreground(); motion();
  try {
    await show('pl');
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press(screen.getByRole('radio', { name: /Zdjęcie kontekstu/ }));
    expect(screen.getByText('✓ Zdjęcie kontekstu')).toBeOnTheScreen();
    // A permission alert makes the app inactive for a moment.
    await act(async () => { listeners.forEach(listener => listener('inactive')); });
    expect(screen.getByText('✓ Zdjęcie kontekstu')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: /Zapis aktywności/ })).toBeNull();
  } finally { restore(); subscription.mockImplementation(original); }
});

test('between the deadline and the cutoff the card line names the cutoff', async () => {
  await show('pl', oath(), fakeController(), clockAt('2026-10-25T00:35:00Z'));
  expect(screen.getByText(/^Trening skończony w terminie\? Prześlij dowód do .*25 paź.*02:45/)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Prześlij dowód' })).toBeOnTheScreen();
});

test('after the cutoff the screen says the window closed and offers no send', async () => {
  const f = await show('pl', oath(), fakeController(), clockAt('2026-10-25T00:46:00Z'));
  expect(screen.getByText('Czas na dowód minął. Kuźnia ustala stan.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Prześlij dowód' })).toBeNull();
  expect(filled()).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Wróć do Przysięgi' }));
  expect(f.onBack).toHaveBeenCalled();
});

test('the open screen moves to the cutoff line after the deadline and closes after the cutoff', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-25T00:29:00Z'));
  try {
    await show('pl', oath(), fakeController(), clockAt('2026-10-25T00:29:00Z'));
    expect(screen.queryByText(/^Trening skończony w terminie\?/)).toBeNull();
    await act(async () => { jest.advanceTimersByTime(2 * 60000); });
    expect(screen.getByText(/^Trening skończony w terminie\?/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Prześlij dowód' })).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(15 * 60000); });
    expect(screen.getByText('Czas na dowód minął. Kuźnia ustala stan.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Prześlij dowód' })).toBeNull();
  } finally { jest.useRealTimers(); }
});

test.each([['before', '2026-10-25T00:40:00Z', 1], ['after', '2026-10-25T00:46:00Z', 0]] as const)('an own waiting copy %s the cutoff (%s) shows %i Żaromir bust', async (_, at, count) => {
  await show('pl', oath(), fakeController({ kind: 'ready', busy: false, pending: pendingFor(oathId), oath: null }), clockAt(at));
  expect(within(screen.getByTestId('proof-pending')).getByText('Dowód zapisany na tym urządzeniu czeka na wysłanie. Serwer go jeszcze nie odebrał.')).toBeOnTheScreen();
  expect(screen.queryAllByTestId('zaromir-bust', { includeHiddenElements: true })).toHaveLength(count);
});

// MVP-22-A8b (review finding): the proof screen's path timer (usePathMoments) stops when the screen unmounts.
test('the path timer stops when the proof screen unmounts', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-25T00:29:00Z'));
  // Restored in finally, so the spies never leak into later tests (MVP-22-A8c).
  const timeouts = jest.spyOn(globalThis, 'setTimeout'); const clears = jest.spyOn(globalThis, 'clearTimeout');
  try {
    const clock = clockAt('2026-10-25T00:29:00Z');
    await show('pl', oath(), fakeController(), clock);
    // The next moment is just after D, a minute away.
    const armed = timeouts.mock.calls.findIndex(([, delay]) => delay === 60001);
    expect(armed).toBeGreaterThanOrEqual(0);
    const timer = timeouts.mock.results[armed].value;
    await act(async () => screen.unmount());
    expect(clears.mock.calls.some(([id]) => id === timer)).toBe(true);
    // A clock correction after the unmount arms nothing, so the clock subscription is gone too.
    const before = timeouts.mock.calls.length;
    await act(async () => { clock.observe('2026-10-25T00:31:00Z'); });
    expect(timeouts.mock.calls.slice(before).filter(([, delay]) => typeof delay === 'number' && delay > 1000)).toEqual([]);
  } finally { timeouts.mockRestore(); clears.mockRestore(); jest.useRealTimers(); }
});

// MVP-22-G24b: drawn Polish prose keeps a single-letter word with the next word. Stored text is bound only at render.
describe('drawn prose binding', () => {
  const raw = { normalizer: (text: string) => text };
  test('Polish lines, folds, the stored declaration and the stored rule bind single-letter words', async () => {
    const value = oath(); const stored = JSON.parse(JSON.stringify(value));
    await show('pl', value);
    expect(screen.getByText('Prywatne fragmenty zasłoń w Zdjęciach, zanim wybierzesz obraz.', raw)).toBeOnTheScreen();
    expect(screen.getByText('Potwierdzam ukończenie treningu wskazanego w tej Przysiędze. Przesłany dowód dotyczy tego treningu.', raw)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'O ocenie dowodu' }));
    expect(screen.getByText(/^Wybierz rodzaj dowodu, dodaj jeden obraz i potwierdź ukończenie treningu\./, raw)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Jak ukryć szczegóły' }));
    expect(screen.getByText(/^W tej aplikacji nie da się przyciąć obrazu\./, raw)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Zasady dowodu' }));
    expect(screen.getByText(/^Zdjęcie musi przedstawiać rozpoznawalne miejsce lub sprzęt pasujący do wybranego treningu/, raw).props.children).toContain('na zegarku lub w aplikacji');
    expect(value).toEqual(stored);
  });
  test('a Polish card line binds single-letter words', async () => {
    await show('pl', oath(), fakeController({ kind: 'storage_unavailable' }));
    expect(screen.getByText('Nie udało się bezpiecznie odczytać zapisanego dowodu. Uruchom aplikację ponownie i\u00a0spróbuj jeszcze raz.', raw)).toBeOnTheScreen();
  });
  test('English keeps single-letter words unbound', async () => {
    await show('en');
    expect(screen.getByText('I confirm that I completed the workout named in this Oath. The proof I submit is from that workout.', raw)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'About the assessment' }));
    expect(screen.getByText('An image cannot show that you finished, how long you trained or who trained, so the Forge also relies on your declaration.', raw)).toBeOnTheScreen();
  });
});

// MVP-22-E2.4 (engagement.md E2, D-E9): the first proof screen per account on this device teaches its first step.
describe('the first proof bark', () => {
  const accountId = '10000000-0000-4000-8000-000000000001';
  const first = { pl: 'Najpierw wybierz rodzaj dowodu.', en: 'First, choose the proof type.' };
  const rotating = ['Trzy kroki: rodzaj, obraz i potwierdzenie. Pójdziemy po kolei.', 'Wybierz rodzaj, dodaj obraz, potwierdź. Resztę zrobi Kuźnia.', 'Dowód to tylko trzy kroki. Zacznij od rodzaju.'];
  const said = (): string | null => screen.queryByLabelText(/^(Żaromir|Zharomir): /)?.props.accessibilityLabel.replace(/^(Żaromir|Zharomir): /, '') ?? null;
  const storage = (read: () => Promise<boolean>) => ({ read: jest.fn(read), markSeen: jest.fn(async () => {}) });
  async function visit(guide: ReturnType<typeof storage>, { locale = 'pl', value = oath(), f = fakeController(), clock }: { locale?: 'pl' | 'en'; value?: Oath; f?: ReturnType<typeof fakeController>; clock?: ReturnType<typeof createServerClock> } = {}) {
    await render(<LocalizationProvider initialLocale={locale}><ProofScreen oath={value} controller={f.controller} clock={clock} guide={{ storage: guide, accountId }}
      onDone={jest.fn()} onBack={jest.fn()} backLabel={locale === 'pl' ? 'Wróć' : 'Back'} /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    return f;
  }

  test.each(['pl', 'en'] as const)('an unseen flag gives the %s teaching bark and marks it seen once', async locale => {
    const guide = storage(async () => false);
    await visit(guide, { locale });
    expect(said()).toBe(first[locale]);
    expect(guide.read).toHaveBeenCalledWith(accountId);
    expect(guide.markSeen).toHaveBeenCalledTimes(1);
    expect(guide.markSeen).toHaveBeenCalledWith(accountId);
  });

  test('once the type is chosen the bark gives way to the rotating line, and the flag is written once', async () => {
    const guide = storage(async () => false);
    await visit(guide);
    await fireEvent.press(screen.getByRole('radio', { name: /Zdjęcie kontekstu/ }));
    expect(rotating).toContain(said());
    expect(guide.markSeen).toHaveBeenCalledTimes(1);
  });

  test('a seen flag gives the rotating line and writes nothing', async () => {
    const guide = storage(async () => true);
    await visit(guide);
    expect(rotating).toContain(said());
    expect(guide.markSeen).not.toHaveBeenCalled();
  });

  test('a failed read gives the bark, because showing it again is the safe loss', async () => {
    const guide = storage(async () => { throw new Error('keychain'); });
    await visit(guide);
    expect(said()).toBe(first.pl);
  });

  test('while the flag is read Żaromir is silent', async () => {
    const guide = storage(() => new Promise<boolean>(() => {}));
    await visit(guide);
    expect(said()).toBeNull();
    expect(guide.markSeen).not.toHaveBeenCalled();
  });

  test('a sending proof keeps Żaromir silent and the flag unwritten', async () => {
    const guide = storage(async () => false);
    await visit(guide, { f: fakeController({ kind: 'ready', busy: true, pending: null, oath: null }) });
    expect(said()).toBeNull();
    expect(guide.markSeen).not.toHaveBeenCalled();
  });

  test('an Oath withdrawn by a pause keeps Żaromir silent and the flag unwritten', async () => {
    const guide = storage(async () => false);
    await visit(guide, { value: oath({ state: 'withdrawn', terminalAt: '2026-10-24T06:00:00Z' }) });
    expect(said()).toBeNull();
    expect(guide.markSeen).not.toHaveBeenCalled();
  });

  test('between the deadline and the cutoff the conditional cutoff line stays and the flag waits', async () => {
    const guide = storage(async () => false);
    await visit(guide, { clock: clockAt('2026-10-25T00:35:00Z') });
    expect(said()).not.toBe(first.pl);
    expect(said()).toMatch(/w terminie/);
    expect(guide.markSeen).not.toHaveBeenCalled();
  });

  test('without a guide the screen keeps the rotating line', async () => {
    await show('pl');
    expect(rotating).toContain(said());
  });
});
