import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { StatusBar } from 'expo-status-bar';
import type { Authentication, SessionController } from './session';
import { AuthView } from './AuthView';

export type AppleAvailability = { isAvailable(): Promise<boolean>; onRevoked(listener: () => void): () => void };
const nativeApple: AppleAvailability = {
  isAvailable: Apple.isAvailableAsync,
  onRevoked(listener) {
    try {
      const subscription = Apple.addRevokeListener(listener);
      return () => subscription.remove();
    } catch { return () => {}; }
  },
};

// The app owns this controller for its lifetime; account subtrees must not replace it.
export function AuthScreen({ controller, authenticate, apple = nativeApple }: { controller: SessionController; authenticate: Authentication; apple?: AppleAvailability }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const mounted = useRef(false);
  const checkGeneration = useRef(0);
  const checkAvailability = useCallback(async () => {
    const generation = ++checkGeneration.current;
    setAvailability('checking');
    let available = false;
    try { available = await apple.isAvailable(); } catch { /* Only safe availability reaches UI. */ }
    if (mounted.current && generation === checkGeneration.current) setAvailability(available ? 'available' : 'unavailable');
  }, [apple]);
  useEffect(() => {
    mounted.current = true;
    void controller.start();
    void checkAvailability();
    const removeRevocation = apple.onRevoked(() => { void controller.nativeRevoked(); });
    const appState = AppState.addEventListener('change', next => {
      if (next === 'active') {
        void controller.foreground();
        void checkAvailability();
      }
    });
    return () => {
      mounted.current = false;
      checkGeneration.current++;
      removeRevocation();
      appState.remove();
    };
  }, [controller, apple, checkAvailability]);
  return <><StatusBar style="light" /><AuthView state={state} availability={availability}
    onLogin={() => { if (availability === 'available') void controller.login(authenticate); }}
    onLogout={() => { void controller.logout(); }}
    onRetry={() => { if (state.kind === 'signed_out') void checkAvailability(); else void controller.retry(); }} /></>;
}
