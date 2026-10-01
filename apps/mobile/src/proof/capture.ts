import { File } from 'expo-file-system';
import * as Picker from 'expo-image-picker';
import { normalizeImage, type NormalizedImage } from './normalizeImage';

export type ProofSource = 'camera' | 'library';
export type CaptureResult = NormalizedImage | { kind: 'cancelled' } | { kind: 'denied'; canAskAgain: boolean } | { kind: 'unavailable' };

/**
 * One image only, never video. EXIF is never requested and there is no in-app crop (owner decisions D2 and D3, ADR 0008).
 * Quality is left alone, because every image is re-encoded by normalizeImage. A photo kept only in iCloud is downloaded,
 * otherwise choosing it would fail.
 */
export const pickerOptions: Picker.ImagePickerOptions = { mediaTypes: ['images'], exif: false, allowsEditing: false, allowsMultipleSelection: false, base64: false, shouldDownloadFromNetwork: true };

/**
 * Deletes a local image the proof flow made: the picker's copy (which may still hold EXIF) or a normalized JPEG that the
 * controller has copied or that was replaced. Best effort, the OS cache is purged eventually anyway.
 */
export function deleteLocalImage(uri: string | null | undefined) {
  if (typeof uri !== 'string' || !uri.startsWith('file://')) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Best effort only. */ }
}

/**
 * The camera asks for its permission first. The photo library uses the system picker, which runs outside the app and needs
 * no library permission, so choosing an image never triggers a full-library prompt. A failed launch reads as unavailable.
 */
export async function captureImage(source: ProofSource): Promise<CaptureResult> {
  let result: Picker.ImagePickerResult;
  try {
    if (source === 'camera') {
      const permission = await Picker.requestCameraPermissionsAsync();
      if (!permission?.granted) return { kind: 'denied', canAskAgain: permission?.canAskAgain !== false };
      result = await Picker.launchCameraAsync(pickerOptions);
    } else result = await Picker.launchImageLibraryAsync(pickerOptions);
  } catch {
    return { kind: 'unavailable' };
  }
  if (!result || result.canceled) return { kind: 'cancelled' };
  const asset = result.assets?.[0];
  if (!asset || asset.type === 'video') return { kind: 'failed' };
  try { return await normalizeImage({ uri: asset.uri, width: asset.width, height: asset.height }); }
  finally { deleteLocalImage(asset.uri); }
}
