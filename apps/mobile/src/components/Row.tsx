import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { borderWidth, colors, space } from '@/theme/tokens';

import { Touchable } from './Touchable';

export type RowProps = {
  children: ReactNode;
  /** A divider above the row: every row of a list but the first. */
  divider?: boolean;
  /** Makes the whole row tappable, like a caregiver in the search results. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** One item of a list: no card, a line between items. Put the price or the action at the right. */
export function Row({ children, divider = false, onPress, accessibilityLabel, style }: RowProps) {
  const rowStyle = [styles.row, divider && styles.divider, style];

  if (onPress) {
    return (
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        pressedScale={0.98}
        style={rowStyle}
      >
        {children}
      </Touchable>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={rowStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 14 },
  divider: { borderTopWidth: borderWidth.hairline, borderTopColor: colors.line },
});
