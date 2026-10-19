// Design system tokens. The source of truth is docs/design/tokens.json; keep both in sync.
// Plain data with no React Native imports, so Node tooling can import it too.

export const colors = {
  cream: '#fff8f0',
  card: '#ffffff',
  line: '#eadfd3',
  lineStrong: '#958879',
  ink: '#3b3346',
  inkMuted: '#6b6274',
  grape: '#e7d6f2',
  grapeDeep: '#6b3a8a',
  grapeDeepPressed: '#4f2a66',
  sage: '#d6e6cc',
  butter: '#ffe9a8',
  sky: '#cfe6f7',
  rose: '#f8d0d2',
  roseDeep: '#a2363f',
} as const;

export type ColorName = keyof typeof colors;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } as const;

export const radius = { sm: 12, md: 20, pill: 999 } as const;

export const shadow = {
  soft: '0 6px 20px rgba(59, 51, 70, 0.08)',
  softUp: '0 -6px 20px rgba(59, 51, 70, 0.08)',
} as const;

/** Minimum size of anything tappable. */
export const touchTarget = 48;

// One family per weight: on Android, fontWeight doesn't pick the file of a loaded font.
export const fontFamily = {
  regular: 'Nunito_400Regular',
  semiBold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
} as const;

export type FontFamily = (typeof fontFamily)[keyof typeof fontFamily];

export const typography = {
  display: { fontFamily: fontFamily.extraBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.32 },
  title: { fontFamily: fontFamily.extraBold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18 },
} as const;

export type TypographyVariant = keyof typeof typography;
