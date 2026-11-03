import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { borderWidth, colors, radius, space, type ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// The icon tells the tones apart: the service colors can't mark a state, and `star` is only for
// the ⭐. A warning gets an ink outline to stand out from information.
const tones = {
  info: { background: 'tint', text: 'ink', icon: 'info' },
  success: { background: 'tint', text: 'ink', icon: 'check' },
  warning: { background: 'white', text: 'ink', icon: 'circle-alert' },
  error: { background: 'dangerTint', text: 'danger', icon: 'circle-alert' },
} satisfies Record<string, { background: ColorName; text: ColorName; icon: IconName }>;

export type BannerProps = {
  tone: keyof typeof tones;
  message: string;
  /** Replaces the tone's icon, such as a lock for a notice about privacy. */
  icon?: IconName;
};

/** A notice. An error is announced to screen readers as soon as it shows up. */
export function Banner({ tone, message, icon }: BannerProps) {
  const { background, text, icon: toneIcon } = tones[tone];
  const isError = tone === 'error';

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      accessibilityRole={isError ? 'alert' : undefined}
      accessibilityLiveRegion={isError ? 'assertive' : 'none'}
      style={[
        styles.banner,
        { backgroundColor: colors[background] },
        tone === 'warning' && styles.outlined,
      ]}
    >
      <Icon name={icon ?? toneIcon} color={text} />
      <Text variant={isError ? 'bodyStrong' : 'body'} color={text} style={styles.message}>
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
  outlined: { borderWidth: borderWidth.strong, borderColor: colors.ink },
  message: { flex: 1 },
});
