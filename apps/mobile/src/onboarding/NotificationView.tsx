import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { Action } from '../ui/Action';
import { Disclosure } from '../ui/Disclosure';
import { tokens } from '../ui/tokens';
import type { NotificationState } from './notifications';

export type NotificationViewProps = {
  state: NotificationState;
  preference: 'enabled' | 'disabled' | null;
  onEnable: () => void;
  onSkip: () => void;
  onRetryPermission: () => void;
  onSettings: () => void;
};

export function NotificationView({ state, preference, onEnable, onSkip, onRetryPermission, onSettings }: NotificationViewProps) {
  const { t } = useTranslation();
  const { permission, busy, error } = state;
  const mayRequest = preference === 'enabled' && permission.canAskAgain
    && (permission.kind === 'not_determined' || permission.kind === 'denied');
  const mayOpenSettings = preference === 'enabled' && permission.kind === 'denied' && !permission.canAskAgain;
  // Only a device state that changes what the player can do stays outside the fold (docs/product/clarity.md rule 1).
  const deviceMatters = permission.kind === 'denied' || permission.kind === 'unavailable' || permission.kind === 'provisional';
  const device = <Text style={styles.body}>{t(`notifications.permission_${permission.kind}`)}</Text>;
  return <View style={styles.content}>
    <View style={styles.group} accessibilityLiveRegion="polite">
      <Text style={styles.body}>{t(`notifications.preference_${preference ?? 'undecided'}`)}</Text>
      <Text style={styles.body}>{t('settings.notifications.future')}</Text>
      {deviceMatters && device}
      {error && <Text accessibilityRole="alert" style={styles.body}>{t(`notifications.error_${error}`)}</Text>}
    </View>
    <Disclosure label={t('notifications.howItWorks')}>
      <View style={styles.group}>
        <Text style={styles.heading} accessibilityRole="header">{t('notifications.accountTitle')}</Text>
        <Text style={styles.body}>{t('notifications.future')}</Text>
      </View>
      {!deviceMatters && <View style={styles.group}>
        <Text style={styles.heading} accessibilityRole="header">{t('notifications.deviceTitle')}</Text>
        {device}
      </View>}
    </Disclosure>
    {preference === null && <>
      <Action label={t('notifications.enable')} onPress={onEnable} busy={busy} />
      <Action label={t('notifications.skip')} onPress={onSkip} busy={busy} variant="secondary" />
    </>}
    {mayRequest && <Action label={t('notifications.askPermission')} onPress={onRetryPermission} busy={busy} variant="secondary" />}
    {mayOpenSettings && <Action label={t('notifications.settings')} onPress={onSettings} busy={busy} variant="secondary" />}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.section },
  group: { gap: tokens.space.item },
  heading: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5, fontWeight: '600' },
  body: { color: tokens.color.text, fontSize: tokens.body, lineHeight: tokens.body * 1.5 },
});
