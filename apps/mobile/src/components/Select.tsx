import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { Touchable } from './Touchable';

export type SelectOption<T extends string> = { value: T; label: string };

export type SelectProps<T extends string> = {
  label: string;
  value: T | null;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
};

/** A field like Input that opens a sheet to pick one option, such as the district. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elige una opción',
  error,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint={error}
        onPress={() => setOpen(true)}
        pressedScale={0.98}
        style={[styles.box, error !== undefined && styles.boxError]}
      >
        <Text color={selected ? 'ink' : 'inkMuted'} style={styles.value} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" />
      </Touchable>
      {error && (
        <Text variant="caption" color="roseDeep">
          {error}
        </Text>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.options}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Touchable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                pressedScale={0.98}
                style={[styles.option, isSelected && styles.optionSelected]}
              >
                <Text variant={isSelected ? 'bodyStrong' : 'body'} style={styles.value}>
                  {option.label}
                </Text>
                {isSelected && <Icon name="check" color="grapeDeep" />}
              </Touchable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  box: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
  },
  boxError: { borderColor: colors.roseDeep },
  value: { flex: 1 },
  options: { gap: space[1] },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
  },
  optionSelected: { backgroundColor: colors.grape },
});
