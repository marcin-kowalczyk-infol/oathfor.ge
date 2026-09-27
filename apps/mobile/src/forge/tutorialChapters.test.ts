import { catalogs } from '../localization/createTranslation';
import { tutorialChapters, tutorialLineKeys, tutorialTitleKey } from './tutorialChapters';

type Catalog = Record<string, unknown>;

const lookup = (catalog: Catalog, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Catalog | undefined)?.[part], catalog);

// Copy tables of docs/product/tutorial.md, accepted by the owner 2026-09-27. Key, Polish, English.
const specRows: [string, string, string][] = [
  ['room.tutorial.intro', 'Opowiem Ci o zasadach Kuźni. Dotknij miejsca, o którym chcesz posłuchać.', 'I will tell you how the Forge works. Touch the place you want to hear about.'],
  ['room.tutorial.again', 'Dotknij kolejnego miejsca albo zamknij rozmowę.', 'Touch another place or close our talk.'],
  ['room.tutorial.end', 'To wszystko, co dziś obowiązuje w Kuźni. Samouczek czeka w menu, gdy zechcesz wrócić.', 'That is everything the Forge follows today. The Tutorial waits in the menu whenever you want to return.'],
  ['room.tutorial.another', 'Inne miejsce', 'Another place'],
  ['room.tutorial.finish', 'Zakończ', 'Finish'],
  ['room.tutorial.close', 'Zamknij samouczek', 'Close the tutorial'],
  ['room.tutorial.hear', 'Posłuchaj: {{place}}', 'Hear about: {{place}}'],
  ['room.tutorial.heard', 'wysłuchane', 'heard'],
  ['room.door', 'Drzwi', 'Door'],
  ['room.tutorial.titles.hearth', 'Palenisko · Składanie Przysięgi', 'Hearth · Making an Oath'],
  ['room.tutorial.hearth.1', 'Przy palenisku wybierasz trening: bieganie, trening siłowy albo mobilność.', 'At the hearth you choose a workout: running, strength training or mobility.'],
  ['room.tutorial.hearth.2', 'Ustalasz start, teraz albo w wybranym terminie, i późniejszy termin ukończenia.', 'You set the start, now or at a chosen time, and a later completion deadline.'],
  ['room.tutorial.hearth.3', 'Zanim złożysz Przysięgę, zobaczysz wszystkie jej zasady. Tworzy ją dopiero Twoja wyraźna zgoda.', 'Before you make the Oath, you see all its rules. Only your explicit acceptance creates it.'],
  ['room.tutorial.hearth.4', 'Złożonych zasad nikt już nie zmieni, także Kuźnia. Inna obietnica to nowa Przysięga.', 'Once made, its rules never change, not even by the Forge. A different promise is a new Oath.'],
  ['room.tutorial.titles.seals', 'Pieczęcie · Bieżące Przysięgi', 'Seals · Current Oaths'],
  ['room.tutorial.seals.1', 'Pieczęcie to Twoje bieżące Przysięgi: zaplanowane, trwające i te, które czekają na rozpatrzenie.', 'The seals are your current Oaths: scheduled, active and those awaiting review.'],
  ['room.tutorial.seals.2', 'Każda Przysięga trzyma czas w swojej strefie. Zmiana strefy w telefonie go nie przesunie.', 'Each Oath keeps its times in its own timezone. Changing your phone’s timezone does not move them.'],
  ['room.tutorial.seals.3', 'O stanie decyduje Kuźnia, nie zegar w telefonie. Gdy minie ostatni termin z zasad, Przysięga czeka na rozpatrzenie. To nie jest niewykonanie.', 'The Forge decides the state, not your phone’s clock. When the last deadline in its rules passes, the Oath awaits review. That is not a miss.'],
  ['room.tutorial.titles.chronicle', 'Kronika · Zakończone Przysięgi', 'Chronicle · Finished Oaths'],
  ['room.tutorial.chronicle.1', 'Kronika przechowuje zakończone Przysięgi razem z ich wynikiem.', 'The chronicle keeps finished Oaths together with their outcome.'],
  ['room.tutorial.chronicle.2', 'Zapisów w kronice nikt nie przepisuje. Każda Przysięga zachowuje zasady przyjęte przy jej złożeniu.', 'Nobody rewrites the chronicle. Each Oath keeps the rules accepted when it was made.'],
  ['room.tutorial.titles.door', 'Drzwi · Postacie i pauza', 'Door · Characters and pause'],
  ['room.tutorial.door.1', 'Drzwi prowadzą do menu. Tam zmienisz postać albo stworzysz nową, najwyżej trzy.', 'The door leads to the menu. There you can switch character or create a new one, up to three.'],
  ['room.tutorial.door.2', 'Każda postać ma własne Przysięgi, własną kronikę i własną pauzę.', 'Each character has its own Oaths, chronicle and pause.'],
  ['room.tutorial.door.3', 'Pauzę włączysz w Ustawieniach. Wycofuje zaplanowane i trwające Przysięgi tej postaci. Te w rozpatrzeniu czekają dalej.', 'You can pause in Settings. It withdraws this character’s scheduled and active Oaths. Those under review keep waiting.'],
  ['room.tutorial.door.4', 'W czasie pauzy nie złożysz nowej Przysięgi. Wznowienie zdejmuje pauzę, ale nie przywraca wycofanych.', 'While paused you cannot make a new Oath. Resuming lifts the pause but does not restore withdrawn Oaths.'],
  ['room.guide.door', 'Drzwi w blasku księżyca prowadzą do menu. Zasady Kuźni opowiem w Samouczku.', 'The moonlit door leads to the menu. I explain the Forge rules in the Tutorial.'],
  ['menu.tutorialDetail', 'Żaromir wyjaśni zasady', 'Zharomir explains the rules'],
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
      expect(Object.keys(lookup(catalog, `room.tutorial.${chapter.place}`) as object)).toEqual(numbers);
    }
  }
});
