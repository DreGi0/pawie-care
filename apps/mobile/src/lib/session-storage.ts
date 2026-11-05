import * as SecureStore from 'expo-secure-store';

// Where the refresh token lives between launches. On the phone it goes to the secure storage
// (Keychain or Keystore). The web has its own version in session-storage.web.ts.

const REFRESH_TOKEN_KEY = 'pawie.refreshToken';

export function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export function writeRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export function deleteRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
