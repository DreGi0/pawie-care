import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { borderWidth, colors, space, touchTarget } from '@/theme/tokens';

import { Text } from './Text';
import { Touchable } from './Touchable';

export type ChipProps = {
  label: string;
  onPress: () => void;
  /**
   * With it, the chip is one option of a choice, such as "Perro" or an amount. Without it, it's
   * a search chip: a value inside a sentence that opens its picker, like "Para [Toby]".
   */
  selected?: boolean;
  /** Drawn before the label. */
  icon?: ReactNode;
  /** The pet's photo in a search chip, in place of the icon. */
  photo?: ReactNode;
  accessibilityLabel?: string;
};

export function Chip({ label, onPress, selected, icon, photo, accessibilityLabel }: ChipProps) {
  const isOption = selected !== undefined;

  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={isOption ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={(pressed) => [
        styles.chip,
        selected && styles.selected,
        !isOption && styles.search,
        photo !== undefined && styles.withPhoto,
        pressed && styles.pressed,
      ]}
    >
      {photo ?? icon}
      <Text
        variant={isOption ? 'label' : 'bodyStrong'}
        color={isOption ? 'ink' : 'primary'}
        style={[!isOption && styles.searchText]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: touchTarget / 2,
    backgroundColor: colors.white,
    borderWidth: borderWidth.hairline,
    borderColor: colors.line,
  },
  selected: {
    backgroundColor: colors.tint,
    borderWidth: borderWidth.strong,
    borderColor: colors.ink,
  },
  // Compact, so a search sentence takes two lines on a 390 pt phone: Lexend is wide.
  search: { alignSelf: 'flex-start', maxWidth: '100%', gap: 6, paddingHorizontal: space[3] },
  searchText: { flexShrink: 1, fontSize: 15, lineHeight: 20 },
  withPhoto: { paddingLeft: 6 },
  pressed: { opacity: 0.8 },
});
