import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

export type CardProps = ViewProps & {
  /** Makes the whole card tappable, like a caregiver in the search results. */
  onPress?: () => void;
};

/** White surface on cream. Colored notices (info, warning, error) are not cards. */
export function Card({ onPress, style, ...props }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
        {...props}
      />
    );
  }
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    backgroundColor: colors.card,
    borderRadius: radius.md,
    boxShadow: shadow.soft,
  },
  pressed: { opacity: 0.8 },
});
