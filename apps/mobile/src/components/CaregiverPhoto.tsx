import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, Image, Path } from 'react-native-svg';

import { colors, fontFamily } from '@/theme/tokens';

import { NIMBUS_BODY, NIMBUS_HAND } from './Nimbus';
import { Text } from './Text';

// The part of Nimbus's 160 × 160 box that holds the body and the hand.
const BOX = { x: 22, y: 30, width: 120, height: 110 };
const STROKE = 2.5;

export type CaregiverPhotoProps = {
  /** Its initials show while there is no photo. */
  name: string;
  photoUrl?: string | null;
  /** 64 in lists, 186 in the profile. The height follows. */
  width?: number;
};

/**
 * The caregiver's photo, cropped with Nimbus's silhouette and outlined in ink. It doesn't count as
 * an appearance of Nimbus. Pets go in a circle (Avatar). Decorative: the name is always next to it.
 */
export function CaregiverPhoto({ name, photoUrl, width = 64 }: CaregiverPhotoProps) {
  // An id for this instance: several photos share a screen, and on the web they share a document.
  const clipId = `photo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const height = (width * BOX.height) / BOX.width;
  // The outline keeps its width whatever the size of the photo.
  const strokeWidth = (STROKE * BOX.width) / width;
  const fontSize = Math.round(width * 0.26);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

  // Drawn like Nimbus: the hand first and the body over it, which hides the inner part of the
  // hand's outline. Masks and clipPaths with several shapes don't render alike on Android, so
  // the photo is clipped by the body alone and the hand stays in tint.
  return (
    <View style={{ width, height }} importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox={`${BOX.x} ${BOX.y} ${BOX.width} ${BOX.height}`}>
        {photoUrl && (
          <Defs>
            <ClipPath id={clipId}>
              <Path d={NIMBUS_BODY} />
            </ClipPath>
          </Defs>
        )}
        <Ellipse
          {...NIMBUS_HAND}
          fill={colors.tint}
          stroke={colors.ink}
          strokeWidth={strokeWidth}
        />
        <Path d={NIMBUS_BODY} fill={colors.tint} />
        {photoUrl && (
          <Image
            href={photoUrl}
            {...BOX}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        )}
        <Path d={NIMBUS_BODY} fill="none" stroke={colors.ink} strokeWidth={strokeWidth} />
      </Svg>
      {!photoUrl && (
        <View style={styles.initials}>
          <Text style={[styles.initialsText, { fontSize, lineHeight: fontSize * 1.15 }]}>
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered on the body: the hand takes the top right corner of the box.
  initials: {
    position: 'absolute',
    top: '2%',
    bottom: 0,
    left: 0,
    right: '3%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { fontFamily: fontFamily.displayExtraBold },
});
