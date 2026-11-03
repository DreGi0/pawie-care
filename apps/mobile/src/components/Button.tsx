import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { borderWidth, colors, radius, space, touchTarget, type ColorName } from '@/theme/tokens';

import { Text } from './Text';
import { Touchable, type TouchableProps } from './Touchable';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<TouchableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  /** Drawn before the label. Give it the label's color. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const labelColor: Record<Variant, ColorName> = {
  primary: 'white',
  secondary: 'ink',
  ghost: 'primary',
  danger: 'danger',
};

/**
 * Each screen has a single primary button, the only block of `primary` on it. `secondary` has
 * an ink outline; `ghost` is for text actions such as links, and `danger` for cancelling.
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
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      style={(pressed) => [
        styles.base,
        styles[variant],
        pressed && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        disabled && (variant === 'primary' ? styles.primaryDisabled : styles.disabled),
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors[color]} />
      ) : (
        <>
          {icon}
          <Text variant="label" color={color} style={variant === 'primary' && styles.primaryLabel}>
            {label}
          </Text>
        </>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radius.md,
  },
  primary: { minHeight: 56, paddingHorizontal: space[6], backgroundColor: colors.primary },
  secondary: {
    minHeight: touchTarget,
    paddingHorizontal: space[4],
    borderWidth: borderWidth.strong,
    borderColor: colors.ink,
  },
  ghost: { minHeight: touchTarget, paddingHorizontal: space[2] },
  danger: { minHeight: touchTarget, paddingHorizontal: space[2] },
  primaryLabel: { fontSize: 18, lineHeight: 22 },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  primaryDisabled: { backgroundColor: colors.line },
  disabled: { borderColor: colors.line },
  pressed: { opacity: 0.7 },
});
