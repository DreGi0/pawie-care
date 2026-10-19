import { StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { colors, type ColorName } from '@/theme/tokens';

export type NimbusProps = {
  /** `hola` waves; `durmiendo` waits asleep. */
  pose: 'hola' | 'durmiendo';
  /** The circle behind Nimbus. */
  background: ColorName;
  size?: number;
};

const ink = colors.ink;

/**
 * Nimbus, the mascot, inside a pastel circle. At most once per screen, and never in lists or
 * forms. It floats while it says hello and breathes while it sleeps. It's drawn from the
 * mockups' SVG until the final assets exist (docs/design/README.md).
 */
export function Nimbus({ pose, background, size = 160 }: NimbusProps) {
  const circle = size + 32;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={pose === 'hola' ? 'Nimbus saluda' : 'Nimbus duerme'}
      style={[
        styles.circle,
        { width: circle, height: circle, borderRadius: circle / 2 },
        { backgroundColor: colors[background] },
      ]}
    >
      <Animated.View style={animations[pose]}>
        <Svg width={size} height={size} viewBox="0 0 160 160">
          {pose === 'hola' ? (
            <>
              <Ellipse
                cx={124}
                cy={54}
                rx={11}
                ry={20}
                transform="rotate(32 124 54)"
                fill={colors.card}
                stroke={ink}
                strokeWidth={3.5}
              />
              <Path
                d="M80 36C112 36 132 60 132 92C132 120 110 136 80 136C50 136 28 120 28 92C28 60 48 36 80 36Z"
                fill={colors.card}
                stroke={ink}
                strokeWidth={3.5}
                strokeLinejoin="round"
              />
              <Ellipse cx={66} cy={86} rx={5} ry={7.5} fill={ink} />
              <Ellipse cx={94} cy={86} rx={5} ry={7.5} fill={ink} />
              <Path
                d="M140 26c5 3 8 8 9 14M146 16c8 5 12 12 13 21"
                fill="none"
                stroke={ink}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <Path
                d="M80 74C118 74 140 98 140 116C140 128 128 132 80 132C32 132 20 128 20 116C20 98 42 74 80 74Z"
                fill={colors.card}
                stroke={ink}
                strokeWidth={3.5}
                strokeLinejoin="round"
              />
              <Path
                d="M58 108c3 4 9 4 12 0M90 108c3 4 9 4 12 0"
                fill="none"
                stroke={ink}
                strokeWidth={3.5}
                strokeLinecap="round"
              />
              <Path
                d="M112 40h12l-12 14h12M132 22h8l-8 10h8"
                fill="none"
                stroke={ink}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

const float = css.keyframes({
  '0%, 100%': { transform: [{ translateY: 0 }] },
  '50%': { transform: [{ translateY: -6 }] },
});

const breathe = css.keyframes({
  from: { transform: [{ scale: 1 }] },
  to: { transform: [{ scale: 1.04 }] },
});

const animations = css.create({
  hola: {
    animationName: float,
    animationDuration: 3000,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },
  durmiendo: {
    animationName: breathe,
    animationDuration: 1800,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
  },
});

const styles = StyleSheet.create({
  circle: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
