export type ServerClock = { observe(serverTime: string): void; now(): number | null; subscribe(listener: () => void): () => void };

// Server now from the last envelope: its serverTime minus the device time at receipt gives the offset.
// Before any envelope there is no server now, so countdowns hide instead of guessing from the device.
export function createServerClock(deviceNow: () => number = Date.now): ServerClock {
  let offset: number | null = null;
  const listeners = new Set<() => void>();
  return {
    observe(serverTime) {
      const server = Date.parse(serverTime);
      if (Number.isNaN(server)) return;
      offset = server - deviceNow();
      listeners.forEach(listener => listener());
    },
    now: () => offset === null ? null : deviceNow() + offset,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
