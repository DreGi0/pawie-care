import { StyleSheet, View, type ViewProps } from 'react-native';

import { borderWidth, colors, radius, space } from '@/theme/tokens';

/**
 * A white surface with a soft edge, for a group of fields or a breakdown. Lists are not cards:
 * they are Rows separated by dividers. Notices are Banners.
 */
export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.line,
  },
});
