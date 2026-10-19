import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space, touchTarget, type ColorName } from '@/theme/tokens';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  /** Drawn before the label. Give it the label's color. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const labelColor: Record<Variant, ColorName> = {
  primary: 'card',
  secondary: 'ink',
  ghost: 'grapeDeep',
  danger: 'roseDeep',
};

/**
 * Each screen has a single primary button: grape-deep is the one strong color per screen.
 * `ghost` is for text actions such as links, and `danger` for cancelling.
 */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  ...props
}: ButtonProps) {
  const color = disabled ? 'inkMuted' : labelColor[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        disabled && variant === 'primary' && styles.primaryDisabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors[color]} />
      ) : (
        <>
          {icon}
          <Text variant="label" color={color}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radius.pill,
  },
  primary: { minHeight: 52, paddingHorizontal: space[6], backgroundColor: colors.grapeDeep },
  secondary: {
    minHeight: 52,
    paddingHorizontal: space[6],
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
  },
  ghost: { minHeight: touchTarget, paddingHorizontal: space[2] },
  danger: { minHeight: touchTarget, paddingHorizontal: space[2] },
  primaryPressed: { backgroundColor: colors.grapeDeepPressed },
  primaryDisabled: { backgroundColor: colors.line },
  pressed: { opacity: 0.7 },
});
