import { placeLit, type PlaceCounts } from './placeLit';
import { scenePlaces, type ScenePlace } from './sceneLayout';

const lit = (counts: PlaceCounts) => scenePlaces.filter(place => placeLit(place, counts));

// docs/product/engagement.md E2 (D-E7): a place lights when it has something, unknown counts fail open.
test.each<[string, PlaceCounts, ScenePlace[]]>([
  ['nothing yet lights only the hearth and the door', { today: 0, history: 0 }, ['hearth', 'door']],
  ['a current Oath lights the seals', { today: 1, history: 0 }, ['hearth', 'seals', 'door']],
  ['a chronicle entry lights the chronicle', { today: 0, history: 1 }, ['hearth', 'chronicle', 'door']],
  ['both counts light every place', { today: 3, history: 22 }, ['hearth', 'seals', 'chronicle', 'door']],
  ['an unknown Today count lights every place', { today: null, history: 0 }, ['hearth', 'seals', 'chronicle', 'door']],
  ['an unknown chronicle count lights every place', { today: 0, history: null }, ['hearth', 'seals', 'chronicle', 'door']],
  ['no answer at all lights every place', { today: null, history: null }, ['hearth', 'seals', 'chronicle', 'door']],
])('%s', (_, counts, expected) => {
  expect(lit(counts)).toEqual(expected);
});

test('the door is lit in every case', () => {
  for (const today of [null, 0, 1]) for (const history of [null, 0, 1]) expect(placeLit('door', { today, history })).toBe(true);
});
