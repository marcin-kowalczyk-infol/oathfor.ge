import { layoutMode } from './layoutMode';
test.each([[349, 1, 'simple'], [350, 1, 'room'], [350, 1.3, 'room'], [350, 1.31, 'simple']] as const)('width %d at text scale %d is %s', (width, fontScale, mode) => {
  expect(layoutMode(width, fontScale)).toBe(mode);
});
