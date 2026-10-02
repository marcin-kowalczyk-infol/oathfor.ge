import { Image } from 'react-native';
import { currentArt } from '../art/current';
import { panelArtSources, preloadPanelArt } from './panelArt';

afterEach(() => jest.restoreAllMocks());
const art = { ...currentArt, zharomirBust: 7, panel: { corner: 1, edgeH: 2, edgeV: 3, fill: 4, plate: 5, rune: 6 } };

test('lists every panel file once', () => {
  expect(panelArtSources(art).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(panelArtSources({ ...art, panel: { ...art.panel, rune: 1 } }).sort()).toEqual([1, 2, 3, 4, 5, 7]);
});

// MVP-22 G35: a fetch that fails or a file without an address only leaves the panel to load the file itself.
test('a failed fetch or an unresolved file never throws', async () => {
  jest.spyOn(Image, 'resolveAssetSource').mockImplementation(source => source === 3 ? null as never : { uri: `asset://${String(source)}`, width: 1, height: 1, scale: 1 });
  const prefetch = jest.spyOn(Image, 'prefetch').mockRejectedValue(new Error('offline'));
  expect(() => preloadPanelArt(art)).not.toThrow();
  await Promise.resolve();
  expect(prefetch).toHaveBeenCalledTimes(6);
  expect(prefetch).not.toHaveBeenCalledWith('asset://3');
});
