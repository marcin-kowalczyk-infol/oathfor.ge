import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import * as Picker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Oath } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { ProofController, ProofControllerState } from './proofController';
import { ProofScreen } from './ProofScreen';
import { createProofController } from './proofController';
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

async function show(locale: 'pl' | 'en' = 'pl', value = oath(), f = fakeController()) {
  const onDone = jest.fn(); const onBack = jest.fn();
  await render(<LocalizationProvider initialLocale={locale}><ProofScreen oath={value} controller={f.controller} onDone={onDone} onBack={onBack} backLabel={locale === 'pl' ? 'Wróć' : 'Back'} /></LocalizationProvider>);
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
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Potwierdzam deklarację ukończenia' }));
  expect(screen.getByRole('checkbox', { name: 'Potwierdzam deklarację ukończenia' })).toBeChecked();
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
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Potwierdzam deklarację ukończenia' }));
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
  expect(screen.getByText(value.snapshot.copy[locale].sections.photo)).toBeOnTheScreen();
  expect(screen.getByText(value.snapshot.copy[locale].sections.activityRecord)).toBeOnTheScreen();
  expect(screen.getByText(value.snapshot.copy[locale].declaration)).toBeOnTheScreen();
  expect(screen.getByText(pl ? 'AI ocenia widoczne elementy dowodu. Sam obraz nie potwierdza ukończenia treningu, jego czasu trwania ani tego, kto go wykonał.'
    : 'AI assesses visible evidence. The image alone does not verify workout completion, duration or who performed it.')).toBeOnTheScreen();
  expect(screen.getByText(pl ? /najpierw przytnij obraz albo zasłoń ten fragment w aplikacji Zdjęcia/ : /crop the image or cover that part in the Photos app first/)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: pl ? 'Prześlij dowód' : 'Submit proof' })).toHaveProp('accessibilityHint', pl ? 'Wybierz rodzaj dowodu.' : 'Choose the type of evidence.');
  expect(screen.getByTestId('proof-sources')).toHaveStyle({ flexDirection: direction });
});

test('sending shows no success until the server answers, then hands back the returned Oath', async () => {
  const f = await show();
  await readyToSend();
  await fireEvent.press(screen.getByRole('button', { name: 'Prześlij dowód' }));
  const pending = { version: 1 as const, accountId: '10000000-0000-4000-8000-000000000001', characterId, oathId, submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo' as const, fileName: '40000000-0000-4000-8000-000000000001.jpg' };
  await act(async () => f.change({ kind: 'ready', busy: true, pending, oath: null }));
  expect(screen.getByText('Wysyłanie dowodu. Przysięga zmieni stan dopiero po odpowiedzi serwera.')).toBeOnTheScreen();
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
  expect(screen.getByText('Could not reach the server. The proof has not been received yet. A copy is waiting on this device.')).toBeOnTheScreen();
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
  [{ kind: 'proof_refused', code: 'receipt_cutoff_passed' }, 'The evidence deadline has passed. The server did not accept this proof.', true],
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
  await fireEvent.press(screen.getByRole('checkbox', { name: 'I confirm the completion declaration' }));
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
  expect(screen.getByText('A proof for another Oath is waiting on this device. Send it now so you can submit proof here.')).toBeOnTheScreen();
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
  expect(screen.queryByText('The evidence deadline has passed. The server did not accept this proof.')).toBeNull();
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
