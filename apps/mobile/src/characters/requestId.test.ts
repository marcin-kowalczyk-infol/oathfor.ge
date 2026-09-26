import { randomUUID } from 'expo-crypto';
import { createRequestId } from './requestId';
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

test('returns the native version 4 UUID in canonical lower case', () => {
  jest.mocked(randomUUID).mockReturnValueOnce('4A1B2C3D-0000-4000-8000-00000000000A');
  expect(createRequestId()).toBe('4a1b2c3d-0000-4000-8000-00000000000a');
});

test('refuses a malformed or missing native value instead of inventing one', () => {
  jest.mocked(randomUUID).mockReturnValueOnce('not-a-uuid' as ReturnType<typeof randomUUID>);
  expect(createRequestId()).toBeUndefined();
  jest.mocked(randomUUID).mockImplementationOnce(() => { throw new Error('DUMMY missing native module'); });
  expect(createRequestId()).toBeUndefined();
});
