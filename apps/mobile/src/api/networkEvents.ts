import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';

/** Tells a screen that the device is back online, so it can ask the server again (the refetch-on-reconnect pattern). */
export interface NetworkEvents {
  onReconnect(listener: () => void): () => void;
}

type Subscribe = (listener: (state: NetworkState) => void) => { remove(): void };

// Reachability when the platform knows it, the link otherwise. Unknown is neither online nor offline.
const online = (state: NetworkState) => state.isInternetReachable ?? state.isConnected;

/** Only a change from offline to online is reported, so the first reading and repeated reports never refetch. */
export function createNetworkEvents(subscribe: Subscribe, read: () => Promise<NetworkState>): NetworkEvents {
  return {
    onReconnect(listener) {
      let last: boolean | undefined;
      let stopped = false;
      const subscription = subscribe(state => {
        const now = online(state);
        if (stopped || now === undefined) return;
        if (now && last === false) listener();
        last = now;
      });
      // A screen opened while offline needs the starting state, because a listener hears changes only.
      read().then(state => { if (last === undefined) last = online(state); }, () => {});
      return () => { stopped = true; subscription.remove(); };
    },
  };
}

export const nativeNetworkEvents: NetworkEvents = createNetworkEvents(listener => addNetworkStateListener(listener), getNetworkStateAsync);
