import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
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
  const { t, i18n } = useTranslation();
  const text = (key: string) => bindShortWords(t(key), i18n.language);
  const { permission, busy, error } = state;
  const mayRequest = preference === 'enabled' && permission.canAskAgain
    && (permission.kind === 'not_determined' || permission.kind === 'denied');
  const mayOpenSettings = preference === 'enabled' && permission.kind === 'denied' && !permission.canAskAgain;
  // Only a device state that blocks the notifications the player turned on stays outside the fold (docs/product/clarity.md
  // rule 1, MVP-22-B1). Settings shows the same cases. Quiet (provisional) delivery counts, because alerts are not guaranteed.
  const blocks = preference === 'enabled' && (permission.kind === 'denied' || permission.kind === 'not_determined'
    || permission.kind === 'unavailable' || permission.kind === 'provisional');
  // Before the choice the honesty line stays visible. After it the review's summary card names the choice, so it folds.
  const chosen = preference !== null;
  const device = <Text style={styles.body}>{text(`notifications.permission_${permission.kind}`)}</Text>;
  const honesty = <Text style={styles.body}>{text('settings.notifications.future')}</Text>;
  return <View style={styles.content}>
    {(!chosen || blocks || error) && <View style={styles.group} accessibilityLiveRegion="polite">
      {!chosen && honesty}
      {blocks && device}
      {error && <Text accessibilityRole="alert" style={styles.body}>{text(`notifications.error_${error}`)}</Text>}
    </View>}
    <Disclosure label={t('notifications.howItWorks')}>
      <View style={styles.group}>
        <Text style={styles.body}>{text(`notifications.preference_${preference ?? 'undecided'}`)}</Text>
        {chosen && honesty}
      </View>
      <View style={styles.group}>
        <Text style={styles.heading} accessibilityRole="header">{t('notifications.accountTitle')}</Text>
        <Text style={styles.body}>{text('notifications.future')}</Text>
      </View>
      {!blocks && <View style={styles.group}>
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
