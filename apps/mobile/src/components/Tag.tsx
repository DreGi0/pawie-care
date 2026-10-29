import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, space, type ColorName } from '@/theme/tokens';

import { Text } from './Text';

// Tones say what the tag means, not its color: butter only exists for the ⭐ and for real warnings.
const tones = {
  certified: { background: 'butter', text: 'ink' },
  warning: { background: 'butter', text: 'ink' },
  info: { background: 'sky', text: 'ink' },
  success: { background: 'sage', text: 'ink' },
  special: { background: 'grape', text: 'ink' },
  // The caregiver's level: a grape Tag, never butter, which is for the ⭐ (RN-NIV-01).
  level: { background: 'grape', text: 'ink' },
  // Declared by the caregiver and not verified, like the skills (RN-CUI-19).
  neutral: { background: 'card', text: 'ink' },
  error: { background: 'rose', text: 'roseDeep' },
} satisfies Record<string, { background: ColorName; text: ColorName }>;

export type TagProps = {
  tone: keyof typeof tones;
  label: string;
  /** Drawn before the label. */
  icon?: ReactNode;
};

export function Tag({ tone, label, icon }: TagProps) {
  const { background, text } = tones[tone];

  return (
    <View style={[styles.tag, { backgroundColor: colors[background] }]}>
      {icon}
      <Text variant="caption" color={text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
  },
});
