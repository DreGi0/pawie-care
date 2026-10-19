import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, touchTarget, type ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Touchable, type TouchableProps } from './Touchable';

export type IconButtonProps = Omit<TouchableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Says what the button does, since there is no text. */
  accessibilityLabel: string;
  /** `raised` sits on cream, like back and close; `plain` goes inside other controls. */
  variant?: 'raised' | 'plain';
  color?: ColorName;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  variant = 'raised',
  color = 'ink',
  style,
  ...props
}: IconButtonProps) {
  return (
    <Touchable
      accessibilityRole="button"
      pressedScale={0.9}
      style={(pressed) => [
        styles.base,
        variant === 'raised' && styles.raised,
        pressed && styles.pressed,
        style,
      ]}
      {...props}
    >
      <Icon name={icon} color={color} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  raised: { backgroundColor: colors.card, boxShadow: shadow.soft },
  pressed: { opacity: 0.7 },
});
