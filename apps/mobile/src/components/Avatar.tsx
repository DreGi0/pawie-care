import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, fontFamily } from '@/theme/tokens';

import { Text } from './Text';

export type AvatarProps = {
  /** Its initials show while there is no photo: "Luna" is L, "Ana Martínez" is AM. */
  name: string;
  photoUrl?: string | null;
  size?: number;
};

/**
 * A pet's photo, in a circle. Caregivers use CaregiverPhoto instead. Decorative: the name is
 * always written next to it.
 */
export function Avatar({ name, photoUrl, size = 56 }: AvatarProps) {
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl) {
    return <Image source={photoUrl} contentFit="cover" style={box} accessible={false} />;
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  // Never under 13 px, the smallest text in the app, not even in the 28 px avatar of a chip.
  const fontSize = Math.max(13, Math.round(size * 0.36));

  return (
    <View style={[styles.initials, box]} importantForAccessibility="no-hide-descendants">
      <Text style={[styles.initialsText, { fontSize, lineHeight: fontSize * 1.2 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tint },
  initialsText: { fontFamily: fontFamily.displayExtraBold },
});
