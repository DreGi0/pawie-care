import { Platform } from 'react-native';

// The Android emulator reaches the computer at 10.0.2.2; the iOS Simulator shares its localhost.
// Set EXPO_PUBLIC_API_URL in .env.local to point somewhere else, such as the deployed demo.
export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({ android: 'http://10.0.2.2:3000', default: 'http://localhost:3000' });
