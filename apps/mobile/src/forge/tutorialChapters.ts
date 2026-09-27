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

export const hearPlace = (tour: Tour, place: TutorialPlace): Tour => ({ ...tour, place, line: 1, ended: false });

/** The chapter footer control: next line, back to the choice, or finish after the fourth distinct place. */
export function tourControl(tour: Tour): { line: number; lines: number; action: 'next' | 'another' | 'finish' } | null {
  const chapter = tutorialChapters.find(item => item.place === tour.place);
  if (!chapter || !tour.place) return null;
  const action = tour.line < chapter.lines ? 'next'
    : tour.heard.length === tutorialChapters.length - 1 && !tour.heard.includes(tour.place) ? 'finish' : 'another';
  return { line: tour.line, lines: chapter.lines, action };
}

export function advanceTour(tour: Tour): Tour {
  if (!tour.place) return tour;
  if (tourControl(tour)?.action === 'next') return { ...tour, line: tour.line + 1 };
  const heard = tour.heard.includes(tour.place) ? tour.heard : [...tour.heard, tour.place];
  return { place: null, line: 1, heard, ended: heard.length === tutorialChapters.length };
}

export const tourTextKey = (tour: Tour) => tour.ended ? 'room.tutorial.end'
  : tour.place ? `room.tutorial.${tour.place}.${tour.line}` : tour.heard.length ? 'room.tutorial.again' : 'room.tutorial.intro';
