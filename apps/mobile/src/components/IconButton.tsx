import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { borderWidth, colors, radius, touchTarget, type ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Touchable, type TouchableProps } from './Touchable';

export type IconButtonProps = Omit<TouchableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Says what the button does, since there is no text. */
  accessibilityLabel: string;
  /** `outlined` is a circle with an ink border, like back; `plain` goes inside other controls. */
  variant?: 'outlined' | 'plain';
  color?: ColorName;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  variant = 'outlined',
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
        variant === 'outlined' && styles.outlined,
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
  outlined: {
    backgroundColor: colors.bg,
    borderWidth: borderWidth.strong,
    borderColor: colors.ink,
  },
  pressed: { opacity: 0.7 },
});
