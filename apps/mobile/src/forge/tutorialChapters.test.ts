import { catalogs } from '../localization/createTranslation';
import { advanceTour, freshTour, hearPlace, moreTour, tourControl, tourTextKey, tutorialChapters, tutorialLineKeys, tutorialTitleKey, type Tour } from './tutorialChapters';

type Catalog = Record<string, unknown>;

const lookup = (catalog: Catalog, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Catalog | undefined)?.[part], catalog);

// Copy tables of docs/product/tutorial.md, accepted by the owner 2026-09-27. Key, Polish, English.
const specRows: [string, string, string][] = [
  ['room.tutorial.intro', 'Opowiem Ci o zasadach Kuźni. Dotknij miejsca, o którym chcesz posłuchać.', 'I will tell you how the Forge works. Touch the place you want to hear about.'],
  ['room.tutorial.again', 'Dotknij kolejnego miejsca albo zamknij rozmowę.', 'Touch another place or close our talk.'],
  ['room.tutorial.end', 'To wszystko, co dziś obowiązuje w Kuźni. Samouczek czeka w menu, gdy zechcesz wrócić.', 'Those are all the rules the Forge follows today. The Tutorial stays in the menu whenever you want to come back.'],
  ['room.tutorial.next', 'Dalej', 'Next'],
  ['room.tutorial.another', 'Inne miejsce', 'Another place'],
  ['room.tutorial.finish', 'Zakończ', 'Finish'],
  ['room.tutorial.close', 'Zamknij samouczek', 'Close the tutorial'],
  ['room.tutorial.hear', 'Posłuchaj: {{place}}', 'Hear about: {{place}}'],
  ['room.tutorial.heard', 'wysłuchane', 'heard'],
  // MVP-22-A5: the visible plate on a heard place.
  ['room.tutorial.heardMark', 'Wysłuchane', 'Heard'],
  ['room.door', 'Drzwi', 'Door'],
  ['room.tutorial.titles.hearth', 'Palenisko · Składanie Przysięgi', 'Hearth · Making an Oath'],
  ['room.tutorial.hearth.1', 'Przy palenisku wybierasz trening: bieganie, trening siłowy albo mobilność.', 'At the hearth you choose a workout: running, strength training or mobility.'],
  ['room.tutorial.hearth.2', 'Ustalasz start, teraz albo w wybranym terminie, i późniejszy termin ukończenia.', 'You set a start, now or at a time you choose, and a later deadline to finish by.'],
  ['room.tutorial.hearth.3', 'Zanim złożysz Przysięgę, zobaczysz wszystkie jej zasady. Tworzy ją dopiero Twoja wyraźna zgoda.', 'Before you make the Oath, you see all its rules. It is made only when you explicitly accept them.'],
  ['room.tutorial.hearth.4', 'Złożonych zasad nikt już nie zmieni, także Kuźnia. Inna obietnica to nowa Przysięga.', 'Once it is made, no one can change its rules, not even the Forge. A different promise means a new Oath.'],
  ['room.tutorial.titles.seals', 'Pieczęcie · Bieżące Przysięgi', 'Seals · Current Oaths'],
  ['room.tutorial.seals.1', 'Pieczęcie to Twoje bieżące Przysięgi: zaplanowane, trwające i te, które czekają na wynik.', 'The seals are your current Oaths: scheduled, active and those awaiting a result.'],
  ['room.tutorial.seals.2', 'Każda Przysięga trzyma czas w swojej strefie. Zmiana strefy w telefonie go nie przesunie.', 'Each Oath keeps its times in its own timezone. Changing your phone’s timezone does not move them.'],
  ['room.tutorial.seals.3', 'O stanie decyduje Kuźnia, nie zegar w telefonie. Po ostatnim terminie Przysięga jest pod rozwagą, a nie niewykonana.', 'The Forge decides the state, not your phone’s clock. After the last deadline the Oath is under review, not missed.'],
  ['room.tutorial.titles.chronicle', 'Kronika · Zakończone Przysięgi', 'Chronicle · Finished Oaths'],
  ['room.tutorial.chronicle.1', 'Kronika przechowuje zakończone Przysięgi razem z ich wynikiem.', 'The chronicle keeps your finished Oaths and their results.'],
  ['room.tutorial.chronicle.2', 'Zapisów w kronice nikt nie przepisuje. Każda Przysięga zachowuje zasady przyjęte przy jej złożeniu.', 'Nobody rewrites the chronicle. Each Oath keeps the rules you accepted when you made it.'],
  ['room.tutorial.titles.door', 'Drzwi · Postacie i pauza', 'Door · Characters and pause'],
  ['room.tutorial.door.1', 'Drzwi prowadzą do menu. Tam zmienisz postać albo stworzysz nową, najwyżej trzy.', 'The door leads to the menu. There you can switch characters or create a new one, up to three.'],
  ['room.tutorial.door.2', 'Każda postać ma własne Przysięgi, własną kronikę i własną pauzę.', 'Each character has its own Oaths, chronicle and pause.'],
  ['room.tutorial.door.3', 'Pauza, włączana w Ustawieniach, wycofuje zaplanowane i trwające Przysięgi tej postaci. Czekające na wynik trwają dalej.', 'When you turn it on in Settings, pause withdraws this character’s scheduled and active Oaths. Those awaiting a result continue.'],
  ['room.tutorial.door.4', 'W czasie pauzy nie złożysz nowej Przysięgi. Wznowienie zdejmuje pauzę, ale nie przywraca wycofanych.', 'While paused you cannot make a new Oath. Resuming lifts the pause but does not restore withdrawn Oaths.'],
  ['menu.tutorialDetail', 'Żaromir wyjaśni zasady', 'Learn the rules from Zharomir'],
  ['tutorial.title', 'Zasady Kuźni', 'Forge rules'],
];

test('every chapter line resolves in both languages', () => {
  for (const chapter of tutorialChapters) {
    for (const key of [tutorialTitleKey(chapter.place), ...tutorialLineKeys(chapter)]) {
      expect(lookup(catalogs.pl, key)).toEqual(expect.stringMatching(/\S/));
      expect(lookup(catalogs.en, key)).toEqual(expect.stringMatching(/\S/));
    }
  }
});

test('both catalogs match the accepted copy tables', () => {
  for (const [key, pl, en] of specRows) {
    expect({ key, pl: lookup(catalogs.pl, key), en: lookup(catalogs.en, key) }).toEqual({ key, pl, en });
  }
});

test('chapters follow the spec order and line counts without orphan copy', () => {
  expect(tutorialChapters).toEqual([
    { place: 'hearth', lines: 4 },
    { place: 'seals', lines: 3 },
    { place: 'chronicle', lines: 2 },
    { place: 'door', lines: 4 },
  ]);
  expect(tutorialLineKeys(tutorialChapters[2])).toEqual(['room.tutorial.chronicle.1', 'room.tutorial.chronicle.2']);
  for (const chapter of tutorialChapters) {
    const numbers = tutorialLineKeys(chapter).map(key => key.split('.').pop());
    for (const catalog of [catalogs.pl, catalogs.en]) {
      expect(Object.keys(lookup(catalog, `room.tutorial.${chapter.place}`) as object)).toEqual([...numbers, 'bark']);
    }
  }
});

// MVP-22-E2.3 (engagement.md E2, D-E8): each chapter in the room opens with one bark. "Więcej" plays its accepted lines.
const barks: [string, string, string][] = [
  ['room.tutorial.hearth.bark', 'Przy ogniu wykuwasz nową Przysięgę.', 'At the fire you forge a new Oath.'],
  ['room.tutorial.seals.bark', 'Pieczęcie to Twoje bieżące Przysięgi.', 'The seals are your current Oaths.'],
  ['room.tutorial.chronicle.bark', 'Kronika pamięta każdą zakończoną Przysięgę.', 'The chronicle remembers every finished Oath.'],
  ['room.tutorial.door.bark', 'Drzwi prowadzą do menu, postaci i pauzy.', 'The door leads to the menu, characters and pause.'],
  ['room.tutorial.more', 'Więcej', 'More'],
];

test.each(barks)('%s reads as written in both languages', (key, polish, english) => {
  expect([lookup(catalogs.pl, key), lookup(catalogs.en, key)]).toEqual([polish, english]);
});

// The engagement spec allows 12 words. The owner's bark cap for slice E is 8 Polish words, here in one sentence.
test.each(tutorialChapters.map(chapter => chapter.place))('the %s bark keeps to 8 Polish words and one sentence', place => {
  for (const catalog of [catalogs.pl, catalogs.en]) {
    const bark = lookup(catalog, `room.tutorial.${place}.bark`) as string;
    expect(bark.split(/[.!?](?:\s|$)/).filter(part => part.trim())).toHaveLength(1);
  }
  expect((lookup(catalogs.pl, `room.tutorial.${place}.bark`) as string).trim().split(/\s+/).length).toBeLessThanOrEqual(8);
});

describe('a chapter in the room', () => {
  const heard = (places: Tour['heard']): Tour => ({ ...freshTour, heard: places });

  test('opens on its bark with "Więcej" and the way to another place', () => {
    const tour = hearPlace(freshTour, 'seals');
    expect(tourTextKey(tour)).toBe('room.tutorial.seals.bark');
    expect(tourControl(tour)).toEqual({ line: 0, lines: 3, action: 'another', more: true });
  });

  test('"Więcej" plays the accepted lines in order with their counter', () => {
    let tour = moreTour(hearPlace(freshTour, 'seals'));
    expect(tourTextKey(tour)).toBe('room.tutorial.seals.1');
    expect(tourControl(tour)).toEqual({ line: 1, lines: 3, action: 'next', more: false });
    tour = advanceTour(advanceTour(tour));
    expect(tourTextKey(tour)).toBe('room.tutorial.seals.3');
    expect(tourControl(tour)).toEqual({ line: 3, lines: 3, action: 'another', more: false });
  });

  test('leaving from the bark counts the chapter as heard', () => {
    expect(advanceTour(hearPlace(freshTour, 'hearth'))).toEqual({ place: null, line: 1, heard: ['hearth'], ended: false });
  });

  test('the fourth distinct chapter finishes from its bark or its last line', () => {
    const fourth = hearPlace(heard(['hearth', 'seals', 'chronicle']), 'door');
    expect(tourControl(fourth)).toEqual({ line: 0, lines: 4, action: 'finish', more: true });
    expect(advanceTour(fourth)).toEqual({ place: null, line: 1, heard: ['hearth', 'seals', 'chronicle', 'door'], ended: true });
    expect(tourControl({ ...moreTour(fourth), line: 4 })?.action).toBe('finish');
  });

  test('"Więcej" outside a bark changes nothing', () => {
    expect(moreTour(freshTour)).toBe(freshTour);
    const second = { ...hearPlace(freshTour, 'hearth'), line: 2 };
    expect(moreTour(second)).toBe(second);
  });
});
