import { AtkinsonHyperlegible_400Regular } from '@expo-google-fonts/atkinson-hyperlegible/400Regular';
import { AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible/700Bold';
import { Gabarito_500Medium } from '@expo-google-fonts/gabarito/500Medium';
import { Gabarito_600SemiBold } from '@expo-google-fonts/gabarito/600SemiBold';
import { Gabarito_700Bold } from '@expo-google-fonts/gabarito/700Bold';
import { Gabarito_800ExtraBold } from '@expo-google-fonts/gabarito/800ExtraBold';

import type { FontFamily } from './tokens';

// One import per weight: each package root would bundle every file of the family.
export const fonts = {
  Gabarito_500Medium,
  Gabarito_600SemiBold,
  Gabarito_700Bold,
  Gabarito_800ExtraBold,
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} satisfies Record<FontFamily, number>;
