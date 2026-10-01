import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

/** Owner decision D2 (ADR 0008): the client sends JPEG at quality 0.85 with the long edge at most 2880 px. */
export const PROOF_LONG_EDGE = 2880;
export const PROOF_JPEG_QUALITY = 0.85;
export type PickedImage = { uri: string; width: number; height: number };
export type NormalizedImage = { kind: 'success'; uri: string; width: number; height: number } | { kind: 'failed' };

// Only the longer side is given, so the manipulator keeps the ratio. A smaller image keeps its size and is not enlarged, which
// relies on the iOS picker reporting the upright size. A stored size of a rotated photo would swap the sides.
function fit(width: number, height: number): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  return width >= height ? { width: Math.min(PROOF_LONG_EDGE, Math.round(width)) } : { height: Math.min(PROOF_LONG_EDGE, Math.round(height)) };
}
const tooLarge = (width: number, height: number) => Math.max(width, height) > PROOF_LONG_EDGE;
function release(value: { release?: () => void } | undefined) { try { value?.release?.(); } catch { /* Native memory is freed later anyway. */ } }

/**
 * Re-encodes a picked image as a new JPEG in the cache. The manipulator draws the pixels upright from the EXIF orientation,
 * and the new file carries no EXIF, so neither GPS nor capture metadata leaves the device. The original is never sent.
 */
export async function normalizeImage(picked: PickedImage): Promise<NormalizedImage> {
  const contexts: { release?: () => void }[] = [];
  const refs: ImageRef[] = [];
  try {
    if (!picked || typeof picked.uri !== 'string' || !picked.uri.startsWith('file://')) return { kind: 'failed' };
    const first = ImageManipulator.manipulate(picked.uri); contexts.push(first);
    // Every image is resized once, also one already within the limit. The resize redraws the pixels upright, so the saved JPEG
    // never depends on an Orientation tag, which the API's GD re-encode would ignore. The iOS picker reports the upright size.
    const target = fit(picked.width, picked.height);
    let ref = await (target ? first.resize(target) : first).renderAsync(); refs.push(ref);
    // Defensive: should a picker ever report the stored size of a rotated photo, the rendered size decides a second pass.
    const again = tooLarge(ref.width, ref.height) ? fit(ref.width, ref.height) : null;
    if (again) {
      const second = ImageManipulator.manipulate(ref); contexts.push(second);
      ref = await second.resize(again).renderAsync(); refs.push(ref);
    }
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: PROOF_JPEG_QUALITY });
    if (typeof saved?.uri !== 'string' || !saved.uri.startsWith('file://') || !(saved.width > 0) || !(saved.height > 0)
      || tooLarge(saved.width, saved.height)) return { kind: 'failed' };
    return { kind: 'success', uri: saved.uri, width: saved.width, height: saved.height };
  } catch {
    return { kind: 'failed' };
  } finally {
    refs.forEach(release); contexts.forEach(release);
  }
}
