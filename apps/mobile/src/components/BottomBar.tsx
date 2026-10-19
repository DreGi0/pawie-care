import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, space } from '@/theme/tokens';

import { Text } from './Text';

export type BottomBarProps = {
  /** Small text over the amount, such as "Luna · 1 visita". */
  caption: string;
  /** The amount, such as "$13.20". */
  amount: string;
  /** The screen's action, usually its primary button. */
  children: ReactNode;
};

/** White bar fixed at the bottom with what it costs and the action, like in Perfil and Reservar. */
export function BottomBar({ caption, amount, children }: BottomBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
      <View>
        <Text variant="caption" color="inkMuted">
          {caption}
        </Text>
        <Text variant="heading">{amount}</Text>
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
    paddingTop: space[4],
    paddingHorizontal: space[4],
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    boxShadow: shadow.softUp,
  },
  action: { flex: 1 },
});
