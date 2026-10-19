import { StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { colors, space, touchTarget } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** A yes or no with its label, such as "No sé la fecha exacta". The whole row is tappable. */
export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <Touchable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      pressedScale={0.98}
      style={styles.row}
    >
      <Animated.View style={[styles.box, checked && styles.checked, transitions.box]}>
        {checked && <Icon name="check" size={18} color="card" />}
      </Animated.View>
      <View style={styles.label}>
        <Text>{label}</Text>
      </View>
    </Touchable>
  );
}

const transitions = css.create({
  box: {
    transitionProperty: ['backgroundColor', 'borderColor'],
    transitionDuration: 150,
  },
});

const styles = StyleSheet.create({
  row: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
  },
  checked: { borderColor: colors.grapeDeep, backgroundColor: colors.grapeDeep },
  label: { flex: 1 },
});
