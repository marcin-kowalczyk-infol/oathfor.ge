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
