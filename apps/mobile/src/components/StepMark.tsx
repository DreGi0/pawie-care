import { StyleSheet, View } from 'react-native';

import { borderWidth, colors, radius } from '@/theme/tokens';

import { Icon } from './Icon';

export type StepMarkProps = {
  done: boolean;
  /** 22 in the level's requirements, 28 next to the steps of the sign-up. */
  size?: number;
};

/**
 * Whether a requirement or a step is done: a `primary` circle with a check, or an empty dashed
 * circle. It's decorative: the row says it in words to screen readers.
 */
export function StepMark({ done, size = 22 }: StepMarkProps) {
  const box = { width: size, height: size };

  return done ? (
    <View style={[styles.mark, styles.done, box]}>
      <Icon name="check" size={Math.round(size * 0.64)} color="white" />
    </View>
  ) : (
    <View style={[styles.mark, styles.pending, box]} />
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  done: { backgroundColor: colors.primary },
  pending: { borderWidth: borderWidth.strong, borderStyle: 'dashed', borderColor: colors.inkMuted },
});
