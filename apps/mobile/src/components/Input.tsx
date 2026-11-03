import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { borderWidth, colors, fontFamily, radius, space } from '@/theme/tokens';

import { Text } from './Text';

export type InputProps = TextInputProps & {
  label: string;
  /** Adds "(opcional)" after the label. */
  optional?: boolean;
  helper?: string;
  /** Replaces the helper and turns the border red. */
  error?: string;
  /** Fixed text before the value, such as "+503". */
  prefix?: string;
  /** Control at the right end, such as the button that shows the password. */
  accessory?: ReactNode;
};

export function Input({
  label,
  optional = false,
  helper,
  error,
  prefix,
  accessory,
  multiline,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const message = error ?? helper;

  return (
    <View style={styles.field}>
      <Text variant="label">
        {label}
        {optional && (
          <Text variant="label" color="inkMuted" style={styles.optional}>
            {' (opcional)'}
          </Text>
        )}
      </Text>
      <View
        style={[
          styles.box,
          multiline && styles.multilineBox,
          error !== undefined && styles.boxError,
          focused && styles.boxFocused,
        ]}
      >
        {prefix && (
          <View style={styles.prefix}>
            <Text variant="bodyStrong">{prefix}</Text>
          </View>
        )}
        <TextInput
          accessibilityLabel={optional ? `${label} (opcional)` : label}
          accessibilityHint={message}
          placeholderTextColor={colors.inkMuted}
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          multiline={multiline}
          style={[
            styles.input,
            prefix && styles.inputAfterPrefix,
            multiline && styles.multilineInput,
            style,
          ]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {accessory}
      </View>
      {message && (
        <Text variant="caption" color={error ? 'danger' : 'inkMuted'}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  optional: { fontFamily: fontFamily.displayMedium },
  box: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: borderWidth.hairline,
    borderColor: colors.inkMuted,
    borderRadius: radius.md,
  },
  multilineBox: { minHeight: 96, alignItems: 'stretch' },
  boxError: { borderWidth: borderWidth.strong, borderColor: colors.danger },
  boxFocused: {
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: colors.primary,
    outlineOffset: 1,
  },
  prefix: {
    paddingLeft: space[4],
    paddingRight: space[3],
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  // No lineHeight on single-line inputs: on iOS it pushes the text off center.
  input: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: space[4],
    paddingVertical: 0,
    fontFamily: fontFamily.text,
    fontSize: 16,
    color: colors.ink,
  },
  inputAfterPrefix: { paddingLeft: space[3] },
  multilineInput: { paddingVertical: space[3], lineHeight: 24, textAlignVertical: 'top' },
});
