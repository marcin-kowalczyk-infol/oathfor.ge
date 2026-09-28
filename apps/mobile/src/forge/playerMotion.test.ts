import { playerSheets } from './playerMotion';

const directions = ['back', 'back-left', 'back-right', 'front', 'front-left', 'front-right', 'left', 'right'] as const;

test('the pilot has every sheet and other presets have none', () => {
  const pilot = playerSheets('starter_02', 'thin')!;
  expect(Object.keys(pilot.walk).sort()).toEqual([...directions].sort());
  expect(Object.keys(pilot.act).sort()).toEqual(['chronicle', 'door', 'hearth', 'seals']);
  for (const sheet of [...Object.values(pilot.walk), pilot.idle]) expect([sheet.cols, sheet.rows]).toEqual([4, 2]);
  for (const sheet of Object.values(pilot.act)) expect([sheet.cols, sheet.rows]).toEqual([2, 2]);
  // Cells 288 × 320 with the soles at 312, as Żaromir's.
  for (const sheet of [...Object.values(pilot.walk), pilot.idle, ...Object.values(pilot.act)]) {
    expect(sheet.aspect).toBeCloseTo(288 / 320);
    expect(sheet.anchor).toEqual({ x: 0.5, y: 312 / 320 });
  }
  expect(playerSheets('starter_02', 'heavy')).toBeNull();
  expect(playerSheets('starter_01', 'thin')).toBeNull();
  expect(playerSheets('starter_99', 'thin')).toBeNull();
});
