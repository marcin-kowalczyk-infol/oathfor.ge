// Imported first so its automatic cleanup runs before the console check below,
// which then also sees warnings raised while trees unmount.
import '@testing-library/react-native';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import { consoleGuard, type ConsoleLevel } from './jest/consoleGuard';

// The library's own mock gives fixed zero insets and a 320 x 640 frame, so layout tests stay deterministic.
// Source: https://appandflow.github.io/react-native-safe-area-context/testing (checked 2026-10-02).
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// Importing expo-notifications registers push token handling and warns about Expo Go in jest.
// The app only reads and requests permissions, and a test file can still replace this mock.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(),
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));

// Plain functions, not jest.spyOn, so resetAllMocks or restoreAllMocks in a test cannot disable the guard.
for (const level of ['error', 'warn'] as ConsoleLevel[]) {
  console[level] = (...args: unknown[]) => consoleGuard.record(level, args);
}

afterEach(() => {
  const problem = consoleGuard.settle();
  if (problem) throw new Error(problem);
});

// Catches updates that land after the last test of a file.
afterAll(() => {
  const problem = consoleGuard.settle();
  if (problem) throw new Error(problem);
});
