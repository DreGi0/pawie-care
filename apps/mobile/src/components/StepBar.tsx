import { StyleSheet, View } from 'react-native';

import { colors, fontFamily, radius, space } from '@/theme/tokens';

import { Text } from './Text';

export type StepBarProps =
  /** "Paso 1 de 2" and a single bar, as in onboarding. */
  | { current: number; total: number; steps?: never }
  /** One labeled segment per step, as in the booking flow. */
  | { current: number; steps: readonly string[]; total?: never };

/** `current` starts at 1. */
export function StepBar(props: StepBarProps) {
  const { current, steps } = props;
  const count = props.steps ? props.steps.length : props.total;
  const a11y = {
    accessible: true,
    accessibilityRole: 'progressbar',
    accessibilityValue: { min: 1, max: count, now: current },
  } as const;

  if (!steps) {
    return (
      <View style={styles.bar} {...a11y} accessibilityLabel={`Paso ${current} de ${count}`}>
        <Text variant="caption" color="inkMuted">
          Paso {current} de {count}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(current / count) * 100}%` }]} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.segments}
      {...a11y}
      accessibilityLabel={`Paso ${current} de ${count}: ${steps[current - 1]}`}
    >
      {steps.map((step, index) => {
        const n = index + 1;
        return (
          <View key={step} style={styles.step}>
            <View
              style={[
                styles.segment,
                { backgroundColor: n <= current ? colors.grapeDeep : colors.line },
              ]}
            />
            <Text
              variant="caption"
              color={n > current ? 'inkMuted' : 'ink'}
              style={n === current && styles.currentLabel}
            >
              {n}. {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: space[2] },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.grapeDeep },
  segments: { flexDirection: 'row', gap: space[2] },
  step: { flex: 1, gap: space[1] },
  segment: { height: 6, borderRadius: radius.pill },
  currentLabel: { fontFamily: fontFamily.extraBold },
});
