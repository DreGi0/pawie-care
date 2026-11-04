import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderWidth, colors, gutter, space } from '@/theme/tokens';

import { Text } from './Text';

export type BottomBarProps = {
  /** The amount, such as "$13.20". Without it, the action takes the whole bar. */
  amount?: string;
  /** What the amount is, under it, such as "Visita para Luna". */
  caption?: string;
  /** The screen's action, usually its primary button. */
  children: ReactNode;
};

/**
 * Bar fixed at the bottom with the screen's action, like in Perfil and Reservar, and what it
 * costs when there is an amount. It keeps clear of the home indicator by itself.
 */
export function BottomBar({ amount, caption, children }: BottomBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
      {amount !== undefined && (
        <View style={styles.total}>
          <Text variant="priceSmall">{amount}</Text>
          {caption && (
            <Text variant="footnote" color="inkMuted">
              {caption}
            </Text>
          )}
        </View>
      )}
      <View style={amount === undefined ? styles.wholeAction : styles.action}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingTop: 14,
    paddingHorizontal: gutter,
    backgroundColor: colors.bg,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.line,
  },
  total: { flex: 1, gap: space[1] },
  action: { flexShrink: 0 },
  wholeAction: { flex: 1 },
});
