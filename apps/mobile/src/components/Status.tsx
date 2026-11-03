import { StyleSheet, View } from 'react-native';

import type { StatusTag } from '@/lib/bookings';
import type { ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const tones = {
  info: { icon: 'clock', color: 'ink' },
  warning: { icon: 'circle-alert', color: 'ink' },
  success: { icon: 'check', color: 'ink' },
  error: { icon: 'x', color: 'danger' },
} satisfies Record<StatusTag['tone'], { icon: IconName; color: ColorName }>;

/**
 * The state of a booking, as text with its icon. It's not a placa and has no color of its own:
 * the service colors mark services, never a state.
 */
export function Status({ tone, label }: StatusTag) {
  const { icon, color } = tones[tone];

  return (
    <View style={styles.status}>
      <Icon name={icon} size={18} color={color} />
      <Text variant="bodyStrong" color={color} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flexShrink: 1 },
});
