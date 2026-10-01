import { ImageManipulator } from 'expo-image-manipulator';
import { normalizeImage } from './normalizeImage';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } }));

type Size = { width: number; height: number };
// Each manipulate call gets its own context. Its render produces the next size in `renders`.
function manipulator(renders: Size[], saved?: Size) {
  const contexts: { resize: jest.Mock; renderAsync: jest.Mock; release: jest.Mock; source: unknown }[] = [];
  const refs: { release: jest.Mock; saveAsync: jest.Mock }[] = [];
  jest.mocked(ImageManipulator.manipulate).mockImplementation(((source: unknown) => {
    const context = { source, release: jest.fn(), resize: jest.fn(), renderAsync: jest.fn(async () => {
      const size = renders.shift()!;
      const ref = { ...size, release: jest.fn(), saveAsync: jest.fn(async () => ({ uri: 'file:///cache/out.jpg', ...(saved ?? size) })) };
      refs.push(ref); return ref;
    }) };
    context.resize.mockReturnValue(context);
    contexts.push(context); return context;
  }) as never);
  return { contexts, refs };
}
beforeEach(() => jest.clearAllMocks());

test('a landscape 4032 × 3024 photo is resized once to 2880 wide and saved as JPEG 0.85', async () => {
  const { contexts, refs } = manipulator([{ width: 2880, height: 2160 }]);
  expect(await normalizeImage({ uri: 'file:///picked/a.jpg', width: 4032, height: 3024 })).toEqual({ kind: 'success', uri: 'file:///cache/out.jpg', width: 2880, height: 2160 });
  expect(contexts).toHaveLength(1);
  expect(contexts[0].resize).toHaveBeenCalledWith({ width: 2880 });
  expect(refs[0].saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
  expect(contexts[0].release).toHaveBeenCalled();
  expect(refs[0].release).toHaveBeenCalled();
});

test('a tall screenshot is limited by its height', async () => {
  const { contexts } = manipulator([{ width: 608, height: 2880 }]);
  await normalizeImage({ uri: 'file:///picked/shot.png', width: 1320, height: 6252 });
  expect(contexts[0].resize).toHaveBeenCalledWith({ height: 2880 });
});

// A small image is still drawn once at its own upright size, so a rotated original is saved with upright pixels and no Orientation tag.
test('a small image is redrawn at its own size without enlarging it', async () => {
  const { contexts, refs } = manipulator([{ width: 1170, height: 2532 }]);
  expect(await normalizeImage({ uri: 'file:///picked/small.png', width: 1170, height: 2532 })).toMatchObject({ kind: 'success', width: 1170, height: 2532 });
  expect(contexts[0].resize).toHaveBeenCalledWith({ height: 2532 });
  expect(refs[0].saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
});

// The picker can report the stored pixel size of a portrait camera photo while the manipulator draws it upright.
test('a rendered result still above the long edge gets a second pass from its upright size', async () => {
  const { contexts, refs } = manipulator([{ width: 2880, height: 3840 }, { width: 2160, height: 2880 }]);
  expect(await normalizeImage({ uri: 'file:///camera/portrait.jpg', width: 4032, height: 3024 })).toMatchObject({ kind: 'success', width: 2160, height: 2880 });
  expect(contexts).toHaveLength(2);
  expect(contexts[1].source).toBe(refs[0]);
  expect(contexts[1].resize).toHaveBeenCalledWith({ height: 2880 });
  expect(refs[0].saveAsync).not.toHaveBeenCalled();
  expect(refs[1].saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
});

test('an oversized or failed result and a non-file source are failures, never a send', async () => {
  manipulator([{ width: 2880, height: 2160 }], { width: 4032, height: 3024 });
  expect(await normalizeImage({ uri: 'file:///picked/a.jpg', width: 4032, height: 3024 })).toEqual({ kind: 'failed' });
  jest.mocked(ImageManipulator.manipulate).mockImplementation(() => { throw new Error('decode'); });
  expect(await normalizeImage({ uri: 'file:///picked/a.jpg', width: 4032, height: 3024 })).toEqual({ kind: 'failed' });
  expect(await normalizeImage({ uri: 'https://example.com/a.jpg', width: 10, height: 10 })).toEqual({ kind: 'failed' });
});
