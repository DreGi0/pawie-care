import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Drawn before the label. */
  icon?: ReactNode;
};

/** One option of a choice, such as "Perro" or "Gato", or an amount. */
export function Chip({ label, selected, onPress, icon }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
  },
  selected: {
    backgroundColor: colors.grape,
    boxShadow: `inset 0 0 0 2px ${colors.grapeDeep}`,
  },
  unselected: { backgroundColor: colors.card, boxShadow: shadow.soft },
  pressed: { opacity: 0.8 },
});
