import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TouchableProps = Omit<PressableProps, 'style'> & {
  /** Like Pressable's: a function gets whether it's pressed. */
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
  /** How much it shrinks while pressed. */
  pressedScale?: number;
};

/**
 * Pressable that shrinks a little while pressed, so every tap in the app answers the same way.
 * The other tappable components are built on it.
 */
export function Touchable({
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  ...props
}: TouchableProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <AnimatedPressable
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        typeof style === 'function' ? style(pressed) : style,
        { transform: [{ scale: pressed ? pressedScale : 1 }] },
        transitions.press,
      ]}
      {...props}
    />
  );
}

// A Reanimated CSS transition: it animates the scale on the UI thread whenever it changes.
const transitions = css.create({
  press: {
    transitionProperty: 'transform',
    transitionDuration: 120,
    transitionTimingFunction: 'ease-out',
  },
});
