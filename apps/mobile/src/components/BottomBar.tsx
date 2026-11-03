import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderWidth, colors, gutter, space } from '@/theme/tokens';

import { Text } from './Text';

export type BottomBarProps = {
  /** The amount, such as "$13.20". */
  amount: string;
  /** What the amount is, under it, such as "Visita para Luna". */
  caption: string;
  /** The screen's action, usually its primary button. */
  children: ReactNode;
};

/** Bar fixed at the bottom with what it costs and the action, like in Perfil and Reservar. */
export function BottomBar({ amount, caption, children }: BottomBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
      <View style={styles.total}>
        <Text variant="priceSmall">{amount}</Text>
        <Text variant="footnote" color="inkMuted">
          {caption}
        </Text>
      </View>
      <View style={styles.action}>{children}</View>
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
});
