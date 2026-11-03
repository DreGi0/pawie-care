import type { CaregiverLevel } from '@pawie/api-client';
import { StyleSheet, View } from 'react-native';

import { LEVEL_NAMES, levelLabel } from '@/lib/caregivers';
import { colors, fontFamily } from '@/theme/tokens';

import { Text } from './Text';

export type LevelTagProps = {
  level: CaregiverLevel;
  /** Over the level: "Nivel" in the profile, "Tu nivel" for the caregiver. */
  caption?: string;
};

/**
 * The level's big placa, hanging from its ring on an ink strap (RN-NIV-01). It goes in the
 * caregiver's profile and in CuiInicio. It takes the width it's given.
 */
export function LevelTag({ level, caption = 'Nivel' }: LevelTagProps) {
  const isSuper = level === 'SUPER';
  const text = isSuper ? 'white' : 'ink';

  return (
    <View accessible accessibilityLabel={levelLabel(level)} style={styles.collar}>
      <View style={styles.strap} />
      <View style={styles.ring} />
      <View style={[styles.tag, { backgroundColor: isSuper ? colors.primary : colors.tint }]}>
        <View style={styles.hole} />
        <Text variant="placa" color={text} style={styles.caption}>
          {caption}
        </Text>
        <Text color={text} style={styles.level}>
          {LEVEL_NAMES[level]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collar: { alignItems: 'center' },
  strap: { alignSelf: 'stretch', height: 10, borderRadius: 5, backgroundColor: colors.ink },
  ring: {
    width: 22,
    height: 30,
    marginTop: -6,
    marginBottom: -14,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 11,
  },
  tag: {
    width: 104,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingHorizontal: 8,
    paddingBottom: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
  },
  hole: {
    position: 'absolute',
    top: 9,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.bg,
  },
  caption: { fontSize: 13, lineHeight: 16, opacity: 0.8 },
  level: {
    marginTop: 6,
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 21,
    lineHeight: 22,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
