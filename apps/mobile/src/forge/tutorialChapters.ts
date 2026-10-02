export type TutorialPlace = 'hearth' | 'seals' | 'chronicle' | 'door';

export type TutorialChapter = { place: TutorialPlace; lines: number };

// Order and bubble counts follow docs/product/tutorial.md. The copy lives only in the catalogs.
export const tutorialChapters: TutorialChapter[] = [
  { place: 'hearth', lines: 4 },
  { place: 'seals', lines: 3 },
  { place: 'chronicle', lines: 2 },
  { place: 'door', lines: 4 },
];

export const tutorialTitleKey = (place: TutorialPlace) => `room.tutorial.titles.${place}`;

export const tutorialLineKeys = ({ place, lines }: TutorialChapter) =>
  Array.from({ length: lines }, (_, index) => `room.tutorial.${place}.${index + 1}`);

/** One tutorial run: the place being told (null for the choice), its line, the heard places and the closing bubble. Nothing is stored. */
export type Tour = { place: TutorialPlace | null; line: number; heard: TutorialPlace[]; ended: boolean };

export const freshTour: Tour = { place: null, line: 1, heard: [], ended: false };

// MVP-22-E2.3 (engagement.md D-E8): a chapter opens on line 0, its bark. Lines 1 and up are the accepted lines behind "Więcej".
export const hearPlace = (tour: Tour, place: TutorialPlace): Tour => ({ ...tour, place, line: 0, ended: false });

/** "Więcej" on a bark opens the chapter's accepted lines. Anywhere else it changes nothing. */
export const moreTour = (tour: Tour): Tour => tour.place && tour.line === 0 ? { ...tour, line: 1 } : tour;

/**
 * The chapter footer control: next line, back to the choice, or finish after the fourth distinct place.
 * On the bark the step already leaves the chapter, and more offers its accepted lines.
 */
export function tourControl(tour: Tour): { line: number; lines: number; action: 'next' | 'another' | 'finish'; more: boolean } | null {
  const chapter = tutorialChapters.find(item => item.place === tour.place);
  if (!chapter || !tour.place) return null;
  const leaving = tour.heard.length === tutorialChapters.length - 1 && !tour.heard.includes(tour.place) ? 'finish' : 'another';
  const action = tour.line > 0 && tour.line < chapter.lines ? 'next' : leaving;
  return { line: tour.line, lines: chapter.lines, action, more: tour.line === 0 };
}

export function advanceTour(tour: Tour): Tour {
  if (!tour.place) return tour;
  if (tourControl(tour)?.action === 'next') return { ...tour, line: tour.line + 1 };
  const heard = tour.heard.includes(tour.place) ? tour.heard : [...tour.heard, tour.place];
  return { place: null, line: 1, heard, ended: heard.length === tutorialChapters.length };
}

export const tourTextKey = (tour: Tour) => tour.ended ? 'room.tutorial.end'
  : tour.place ? `room.tutorial.${tour.place}.${tour.line === 0 ? 'bark' : tour.line}` :tour.heard.length ? 'room.tutorial.again' : 'room.tutorial.intro';
