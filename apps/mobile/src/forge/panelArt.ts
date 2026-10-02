import { Image } from 'react-native';
import type { ArtSet } from '../art/registry';

/** The files the dialogue panel draws: its painted frame, plate and rune, and Żaromir's bust. */
export function panelArtSources(art: ArtSet): number[] {
  const { corner, edgeH, edgeV, fill, plate, rune } = art.panel;
  return [...new Set([corner, edgeH, edgeV, fill, plate, rune, art.zharomirBust])];
}

/**
 * MVP-22 G35: fetches the panel's files ahead of the room, so the panel's own wait for its art (DialoguePanel) ends in a frame.
 * A failed fetch only means the panel loads the file itself.
 */
export function preloadPanelArt(art: ArtSet) {
  for (const source of panelArtSources(art)) {
    const uri = Image.resolveAssetSource(source)?.uri;
    if (uri) Promise.resolve(Image.prefetch(uri)).catch(() => undefined);
  }
}
