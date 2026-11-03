// Design system tokens, Placas direction. The source of truth is docs/design/tokens.json;
// keep both in sync. Plain data with no React Native imports, so Node tooling can import it too.

export const colors = {
  bg: '#F2F5FA',
  ink: '#25204A',
  inkMuted: '#575272',
  primary: '#3E2F9E',
  primaryPressed: '#2F2380',
  tint: '#E4E0F7',
  line: '#D9DEEA',
  white: '#FFFFFF',
  // Service colors mark a service and nothing else, never a state.
  paseo: '#BDE3F7',
  visita: '#C9EDD8',
  pernocta: '#D8CDF6',
  // Only the ⭐ of special care.
  star: '#FFE07A',
  danger: '#A2363F',
  dangerTint: '#F8D0D2',
} as const;

export type ColorName = keyof typeof colors;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

/** Side margin of every screen. */
export const gutter = space[5];

// By hierarchy: the bigger the surface, the rounder. There are no shadows.
export const radius = {
  /** Option rows, swatches and small tiles. */
  sm: 12,
  /** Controls: buttons, placas, inputs and notices. */
  md: 16,
  /** Big surfaces: service blocks, sheets and the level placa. */
  lg: 26,
  pill: 999,
} as const;

export const borderWidth = {
  /** Dividers and soft edges, in `line`. */
  hairline: 1.5,
  /** Secondary buttons and outlined controls, in `ink`. */
  strong: 2,
  /** The selected service block. */
  selected: 3,
} as const;

/** Minimum size of anything tappable. */
export const touchTarget = 48;

// One family per weight: on Android, fontWeight doesn't pick the file of a loaded font.
export const fontFamily = {
  displayMedium: 'Gabarito_500Medium',
  displaySemiBold: 'Gabarito_600SemiBold',
  displayBold: 'Gabarito_700Bold',
  displayExtraBold: 'Gabarito_800ExtraBold',
  text: 'AtkinsonHyperlegible_400Regular',
  textBold: 'AtkinsonHyperlegible_700Bold',
} as const;

export type FontFamily = (typeof fontFamily)[keyof typeof fontFamily];

// Gabarito for titles, prices, placas and buttons; Atkinson Hyperlegible for reading.
export const typography = {
  /** The caregiver's name in the profile and the hero of Bienvenida. */
  display: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.48,
  },
  /** Screen titles. */
  title: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  /** Section titles. */
  heading: { fontFamily: fontFamily.displayBold, fontSize: 20, lineHeight: 24 },
  /** Names in rows and the name of a service block. */
  subheading: { fontFamily: fontFamily.displayBold, fontSize: 18, lineHeight: 22 },
  price: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.64,
  },
  priceSmall: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: -0.52,
  },
  /** Buttons, chips and field labels. */
  label: { fontFamily: fontFamily.displayBold, fontSize: 16, lineHeight: 20 },
  /** The text of a placa. */
  placa: { fontFamily: fontFamily.displaySemiBold, fontSize: 14, lineHeight: 18 },
  body: { fontFamily: fontFamily.text, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamily.textBold, fontSize: 16, lineHeight: 23 },
  /** Secondary text, usually in inkMuted. */
  caption: { fontFamily: fontFamily.text, fontSize: 14, lineHeight: 20 },
  /** The smallest text in the app, like "la visita" under a price. */
  footnote: { fontFamily: fontFamily.text, fontSize: 13, lineHeight: 17 },
} as const;

export type TypographyVariant = keyof typeof typography;
