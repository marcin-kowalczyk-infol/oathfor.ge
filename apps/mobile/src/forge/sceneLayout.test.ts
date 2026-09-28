import { aside, bodyBox, depth, places, playerStart, scenePlaces, SEALS_FRONT_Y, tutor, walkDirection, walkDuration, type Spot } from './sceneLayout';

const windows = [{ width: 375, height: 667 }, { width: 440, height: 956 }];
const overlaps = (a: Spot, b: Spot, window: { width: number; height: number }) => {
  const one = bodyBox(a, window);
  const two = bodyBox(b, window);
  return one.left < two.right && two.left < one.right && one.top < two.bottom && two.top < one.bottom;
};

describe.each(windows)('at $width × $height', window => {
  test('player and guide spots of every place do not overlap', () => {
    for (const place of scenePlaces) expect([place, overlaps(places[place].player, places[place].guide, window)]).toEqual([place, false]);
  });

  test('Żaromir aside never touches a player spot or the start point', () => {
    for (const spot of [...scenePlaces.map(place => places[place].player), playerStart]) expect([spot, overlaps(aside, spot, window)]).toEqual([spot, false]);
  });

  test('the tutorial place keeps clear of the start point', () => {
    expect(overlaps(tutor, playerStart, window)).toBe(false);
  });

  test('every spot and its body stay inside the visible scene', () => {
    const spots = [...scenePlaces.flatMap(place => [places[place].player, places[place].guide]), aside, tutor, playerStart];
    for (const spot of spots) {
      const box = bodyBox(spot, window);
      expect([spot, box.left >= 0 && box.right <= window.width && box.top >= 0 && box.bottom <= window.height]).toEqual([spot, true]);
    }
  });
});

test('a figure deeper in the room gets a smaller body', () => {
  const window = windows[0];
  const near = bodyBox(playerStart, window);
  const far = bodyBox(places.door.player, window);
  expect(far.bottom - far.top).toBeLessThan(near.bottom - near.top);
  expect(depth(0.82)).toBe(1);
  expect(depth(0.45)).toBeCloseTo(0.86);
});

test('Żaromir keeps his tutorial place and is never left standing on the seal pedestals at the door', () => {
  expect(tutor).toEqual({ x: 0.5, y: 0.66 });
  // Behind the drums the cut covers him. In front of them he must stand clear of the pedestals, which end near y 0.60.
  const door = places.door.guide;
  expect(door.y < SEALS_FRONT_Y || door.y >= 0.6).toBe(true);
});

test('walking picks one of eight sheets that faces the travel direction and never mirrors', () => {
  const start = { x: 0.5, y: 0.82 };
  const hearth = { x: 0.515, y: 0.565 };
  const seals = { x: 0.30, y: 0.635 };
  const chronicle = { x: 0.72, y: 0.65 };
  expect(walkDirection(start, chronicle)).toBe('back-right');
  expect(walkDirection(start, seals)).toBe('back-left');
  expect(walkDirection(start, hearth)).toBe('back');
  expect(walkDirection(start, { x: 0.19, y: 0.50 })).toBe('back-left');
  expect(walkDirection(hearth, start)).toBe('front');
  expect(walkDirection(hearth, chronicle)).toBe('front-right');
  expect(walkDirection(chronicle, { x: 0.5, y: 0.66 })).toBe('left');
  expect(walkDirection(seals, chronicle)).toBe('right');
  expect(walkDirection(seals, start)).toBe('front-right');
  expect(walkDirection(chronicle, start)).toBe('front-left');
});

test('a longer walk takes longer, within a bounded time', () => {
  const start = { x: 0.5, y: 0.82 };
  const near = walkDuration(start, { x: 0.5, y: 0.78 });
  const far = walkDuration(start, { x: 0.19, y: 0.50 });
  expect(far).toBeGreaterThan(walkDuration(start, { x: 0.515, y: 0.565 }));
  expect(near).toBeGreaterThanOrEqual(600);
  expect(far).toBeLessThanOrEqual(1800);
});
