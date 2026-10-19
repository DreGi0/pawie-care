import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type ColorName, type TypographyVariant } from '@/theme/tokens';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
};

/** Use it instead of React Native's Text: React Native has no global font, so this is what applies Nunito. */
export function Text({ variant = 'body', color = 'ink', style, ...props }: TextProps) {
  return <RNText style={[typography[variant], { color: colors[color] }, style]} {...props} />;
}
