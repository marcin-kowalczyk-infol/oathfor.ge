import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';
import type { ReactNode } from 'react';
import { MotionSuspended, useMotionAllowed } from './useMotion';

test('a hidden subtree keeps motion off even when the system allows it', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  let suspended = true;
  const wrapper = ({ children }: { children: ReactNode }) => <MotionSuspended suspended={suspended}>{children}</MotionSuspended>;
  const hook = await renderHook(() => useMotionAllowed(), { wrapper });
  await act(async () => {});
  expect(hook.result.current).toBe(false);
  suspended = false;
  await hook.rerender({});
  expect(hook.result.current).toBe(true);
});
