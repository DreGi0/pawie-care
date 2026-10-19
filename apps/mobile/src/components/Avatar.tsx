import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, fontFamily, radius } from '@/theme/tokens';

import { Text } from './Text';

const sizes = {
  40: { fontSize: 15, lineHeight: 20 },
  48: { fontSize: 16, lineHeight: 24 },
  56: { fontSize: 18, lineHeight: 24 },
} as const;

export type AvatarProps = {
  /** Its initials show while there is no photo: "Luna" is L, "Ana Martínez" is AM. */
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof sizes;
};

/** Decorative: the name is always written next to it. */
export function Avatar({ name, photoUrl, size = 48 }: AvatarProps) {
  const box = { width: size, height: size };

  if (photoUrl) {
    return (
      <Image source={photoUrl} contentFit="cover" style={[styles.avatar, box]} accessible={false} />
    );
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      style={[styles.avatar, styles.initials, box]}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initialsText, sizes[size]]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: radius.pill },
  initials: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grape },
  initialsText: { fontFamily: fontFamily.extraBold },
});
