import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

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
  /** Replaces the tone's icon, such as a lock for a notice about privacy. */
  icon?: IconName;
};

/** A colored notice. An error is announced to screen readers as soon as it shows up. */
export function Banner({ tone, message, icon }: BannerProps) {
  const { background, text, icon: toneIcon } = tones[tone];
  const isError = tone === 'error';

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      accessibilityRole={isError ? 'alert' : undefined}
      accessibilityLiveRegion={isError ? 'assertive' : 'none'}
      style={[styles.banner, { backgroundColor: colors[background] }]}
    >
      <Icon name={icon ?? toneIcon} color={text} />
      <Text color={text} style={[styles.message, isError && styles.errorMessage]}>
        {message}
      </Text>
    </Animated.View>
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
