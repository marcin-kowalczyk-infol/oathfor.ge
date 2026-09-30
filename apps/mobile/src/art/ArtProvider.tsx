import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { cinematicArt } from './cinematic';
import { currentArt } from './current';
import { mergeArt, type ArtOverrides, type ArtSet, type ArtStyle } from './registry';

/** The art of a style: the current set, or the cinematic files over it. */
export function resolveArt(style: ArtStyle, cinematic: ArtOverrides = cinematicArt): ArtSet {
  return style === 'cinematic' ? mergeArt(currentArt, cinematic) : currentArt;
}

// Without a provider every screen draws the current style, as production does.
const ArtContext = createContext<ArtSet>(currentArt);

export function ArtProvider({ style, children }: { style: ArtStyle; children: ReactNode }) {
  const art = useMemo(() => resolveArt(style), [style]);
  return <ArtContext.Provider value={art}>{children}</ArtContext.Provider>;
}

/** A given art set, for example a room without its cuts in tests. */
export function ArtSetProvider({ art, children }: { art: ArtSet; children: ReactNode }) {
  return <ArtContext.Provider value={art}>{children}</ArtContext.Provider>;
}

export const useArt = () => useContext(ArtContext);
