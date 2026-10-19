import { StyleSheet, View } from 'react-native';

import { colors, fontFamily, radius, space, type ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const tones = {
  info: { background: 'sky', text: 'ink', icon: 'info' },
  success: { background: 'sage', text: 'ink', icon: 'check' },
  // butter is for real warnings only, like a payment about to expire.
  warning: { background: 'butter', text: 'ink', icon: 'clock' },
  error: { background: 'rose', text: 'roseDeep', icon: 'circle-alert' },
} satisfies Record<string, { background: ColorName; text: ColorName; icon: IconName }>;

export type BannerProps = {
  tone: keyof typeof tones;
  message: string;
};

/** A colored notice. An error is announced to screen readers as soon as it shows up. */
export function Banner({ tone, message }: BannerProps) {
  const { background, text, icon } = tones[tone];
  const isError = tone === 'error';

  return (
    <View
      accessibilityRole={isError ? 'alert' : undefined}
      accessibilityLiveRegion={isError ? 'assertive' : 'none'}
      style={[styles.banner, { backgroundColor: colors[background] }]}
    >
      <Icon name={icon} color={text} />
      <Text color={text} style={[styles.message, isError && styles.errorMessage]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
  },
  message: { flex: 1 },
  errorMessage: { fontFamily: fontFamily.semiBold },
});
