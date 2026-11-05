import { Platform } from 'react-native';

// The Android emulator reaches the computer at 10.0.2.2; the iOS Simulator shares its localhost.
// Set EXPO_PUBLIC_API_URL in .env.local to point somewhere else, such as the deployed demo.
export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({ android: 'http://10.0.2.2:3000', default: 'http://localhost:3000' });

/** The build of the public demo (docs/plan-v0.6.md, etapa Demo pública): EXPO_PUBLIC_DEMO=true. */
export const isDemo = process.env.EXPO_PUBLIC_DEMO === 'true';

/** The app running in a browser, which lacks some of the phone's modules. */
export const isWeb = Platform.OS === 'web';
