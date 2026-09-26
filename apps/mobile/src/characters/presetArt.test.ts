import { presetArt, drawablePresets } from './presetArt';

describe('preset art', () => {
  it('maps every DUMMY preset to a figure and a portrait', () => {
    for (const id of ['dummy_braid', 'dummy_cropped', 'dummy_curly', 'dummy_tied']) {
      const art = presetArt(id);
      expect(art).not.toBeNull();
      expect(art!.figure).toBeTruthy();
      expect(art!.portrait).toBeTruthy();
      expect(art!.dummy).toBe(true);
    }
  });

  it('returns null for a preset the app cannot draw', () => {
    expect(presetArt('owner_final_01')).toBeNull();
    expect(presetArt('__proto__')).toBeNull();
  });

  it('offers only server presets the app can draw, in server order', () => {
    expect(drawablePresets(['dummy_tied', 'owner_final_01', 'dummy_braid'])).toEqual(['dummy_tied', 'dummy_braid']);
  });
});
