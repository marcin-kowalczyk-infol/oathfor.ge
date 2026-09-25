import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export type DevicePermission = {
  kind: 'not_determined' | 'granted' | 'denied' | 'provisional' | 'ephemeral'; canAskAgain: boolean;
} | { kind: 'unavailable'; canAskAgain: false };

export interface NotificationPermissions {
  read(): Promise<DevicePermission>;
  request(): Promise<DevicePermission>;
  openSettings(): Promise<boolean>;
}

const unavailable: DevicePermission = { kind: 'unavailable', canAskAgain: false };

function permission(value: unknown): DevicePermission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable;
  const result = value as Record<string, unknown>;
  if (typeof result.canAskAgain !== 'boolean' || typeof result.status !== 'string'
    || !['undetermined', 'granted', 'denied'].includes(result.status)) return unavailable;
  let kind: Exclude<DevicePermission['kind'], 'unavailable'>;
  if (result.ios !== undefined) {
    if (!result.ios || typeof result.ios !== 'object' || Array.isArray(result.ios)) return unavailable;
    switch ((result.ios as Record<string, unknown>).status) {
      case Notifications.IosAuthorizationStatus.NOT_DETERMINED: kind = 'not_determined'; break;
      case Notifications.IosAuthorizationStatus.DENIED: kind = 'denied'; break;
      case Notifications.IosAuthorizationStatus.AUTHORIZED: kind = 'granted'; break;
      case Notifications.IosAuthorizationStatus.PROVISIONAL: kind = 'provisional'; break;
      case Notifications.IosAuthorizationStatus.EPHEMERAL: kind = 'ephemeral'; break;
      default: return unavailable;
    }
  } else {
    kind = result.status === 'undetermined' ? 'not_determined' : result.status === 'granted' ? 'granted' : 'denied';
  }
  return { kind, canAskAgain: result.canAskAgain };
}

export const nativeNotificationPermissions: NotificationPermissions = {
  async read() {
    try { return permission(await Notifications.getPermissionsAsync()); }
    catch { return unavailable; }
  },
  async request() {
    try {
      return permission(await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      }));
    } catch { return unavailable; }
  },
  async openSettings() {
    try { await Linking.openSettings(); return true; }
    catch { return false; }
  },
};
