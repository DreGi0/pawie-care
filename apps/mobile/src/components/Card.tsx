import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

import { Touchable } from './Touchable';

export type CardProps = ViewProps & {
  /** Makes the whole card tappable, like a caregiver in the search results. */
  onPress?: () => void;
};

/** White surface on cream. Colored notices (info, warning, error) are not cards. */
export function Card({ onPress, style, ...props }: CardProps) {
  if (onPress) {
    return (
      <Touchable
        accessibilityRole="button"
        onPress={onPress}
        pressedScale={0.98}
        style={[styles.card, style]}
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
});
