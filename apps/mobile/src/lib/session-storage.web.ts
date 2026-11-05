import { isDemo } from './config';

// Web version of session-storage.ts: expo-secure-store doesn't exist in the browser, so the
// refresh token goes to localStorage. This is an exception to docs/arquitectura.md §4.4, only
// for the public demo: the API and the web live on different domains, so httpOnly cookies
// would be third-party ones and browsers block them. It's allowed only in a build made with
// EXPO_PUBLIC_DEMO=true; any other web build refuses to store the token.

const REFRESH_TOKEN_KEY = 'pawie.refreshToken';

export async function readRefreshToken(): Promise<string | null> {
  return isDemo ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}

export async function writeRefreshToken(token: string): Promise<void> {
  if (!isDemo) {
    throw new Error(
      'The web build only stores the session in the public demo (EXPO_PUBLIC_DEMO=true).',
    );
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export async function deleteRefreshToken(): Promise<void> {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
