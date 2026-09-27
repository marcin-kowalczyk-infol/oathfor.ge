import { presetArt, drawablePresets } from './presetArt';

const file = (source: unknown) => String((source as { testUri?: string }).testUri ?? source);
const starters = ['01', '02', '03', '04', '05', '06'];

describe('preset art', () => {
  it('maps every starter in both builds to its own figure and portrait', () => {
    for (const number of starters) for (const build of ['thin', 'heavy'] as const) {
      const art = presetArt(`starter_${number}`, build);
      expect(art).not.toBeNull();
      expect(Object.keys(art!).sort()).toEqual(['figure', 'portrait']);
      expect(file(art!.figure)).toMatch(new RegExp(`starter-${number}-${build}-figure-v01\\.png$`));
      expect(file(art!.portrait)).toMatch(new RegExp(`starter-${number}-${build}-portrait-v01\\.png$`));
    }
  });

  it('returns null for a preset or build the app cannot draw', () => {
    expect(presetArt('owner_final_01', 'thin')).toBeNull();
    expect(presetArt('dummy_braid', 'thin')).toBeNull();
    expect(presetArt('__proto__', 'thin')).toBeNull();
    expect(presetArt('starter_01', 'broad' as never)).toBeNull();
    expect(presetArt('starter_01', 'constructor' as never)).toBeNull();
  });

  it('offers only server presets the app can draw, in server order', () => {
    expect(drawablePresets(['starter_04', 'owner_final_01', 'dummy_braid', 'starter_01'])).toEqual(['starter_04', 'starter_01']);
  });
});
