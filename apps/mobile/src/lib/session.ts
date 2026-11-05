import { ApiError, authLogout, type AppMode, type AuthSession } from '@pawie/api-client';
import { useSyncExternalStore } from 'react';

import { apiBaseUrl } from './config';
import { deleteRefreshToken, readRefreshToken, writeRefreshToken } from './session-storage';

// The access token lives in memory only. The refresh token goes to the phone's secure
// storage (Keychain or Keystore), so the session survives closing the app. Where it lives is
// in session-storage.ts, with a web version for the public demo.

export type SessionStatus = 'loading' | 'signedIn' | 'signedOut';
// Renew this long before the access token expires, so no request leaves with a stale one.
const EXPIRY_MARGIN_MS = 30_000;

let status: SessionStatus = 'loading';
let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let refreshToken: string | null = null;
let renewal: Promise<string | null> | null = null;
// A new account registers its first pet and address before reaching the tabs.
let onboarding = false;
// RN-CTA-06: owner or caregiver tabs. The account remembers it, and every sign-in and renewal
// brings it, so the app opens in the right mode without waiting for another request.
let mode: AppMode = 'OWNER';
const listeners = new Set<() => void>();

export function getSessionStatus(): SessionStatus {
  return status;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(subscribeSession, getSessionStatus);
}

function setStatus(next: SessionStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

export function useOnboarding(): boolean {
  return useSyncExternalStore(subscribeSession, () => onboarding);
}

export function useMode(): AppMode {
  return useSyncExternalStore(subscribeSession, () => mode);
}

/** After the API saved the new mode (PATCH /v1/users/me or POST /v1/caregivers/me). */
export function setMode(next: AppMode): void {
  mode = next;
  setStatus(status);
}

/** Keeps the session that a sign-in or a sign-up returned. A sign-up goes to onboarding. */
export async function signIn(session: AuthSession, { newAccount = false } = {}): Promise<void> {
  await keep(session);
  onboarding = newAccount;
  setStatus('signedIn');
}

/** Takes the new account from onboarding to the tabs. */
export function finishOnboarding(): void {
  onboarding = false;
  setStatus(status);
}

export async function signOut(): Promise<void> {
  const token = refreshToken;
  await forget();
  // The session is already gone here; revoking it in the API can fail without consequences.
  if (token) authLogout({ refreshToken: token }).catch(() => {});
}

/** At startup: trades the stored refresh token for a new access token. */
export async function restoreSession(): Promise<void> {
  try {
    refreshToken = await readRefreshToken();
    if (refreshToken) await renew();
  } catch {
    // The API is unreachable: keep the refresh token and renew on the next request.
  }
  setStatus(refreshToken ? 'signedIn' : 'signedOut');
}

/** For configureApiClient: the access token, renewed first if it's about to expire. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < accessTokenExpiresAt - EXPIRY_MARGIN_MS) {
    return accessToken;
  }
  return refreshToken ? renew() : null;
}

/** One renewal at a time: requests that need it meanwhile wait for the same one. */
function renew(): Promise<string | null> {
  renewal ??= requestRenewal().finally(() => {
    renewal = null;
  });
  return renewal;
}

// Uses fetch and not the generated authRefresh(): that one asks getAccessToken() for a
// token first, which would wait for this very renewal.
async function requestRenewal(): Promise<string | null> {
  const sent = refreshToken;
  const response = await fetch(`${apiBaseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: sent }),
  });
  if (refreshToken !== sent) {
    // Signed out while waiting: don't bring the session back.
    return null;
  }
  if (response.status === 401) {
    // INVALID_REFRESH_TOKEN: it expired, or the API revoked it.
    await forget();
    return null;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  await keep(body as AuthSession);
  return accessToken;
}

async function keep(session: AuthSession) {
  // First, so a storage that refuses the token (web outside the demo) leaves no session behind.
  await writeRefreshToken(session.refreshToken);
  accessToken = session.accessToken;
  accessTokenExpiresAt = Date.now() + session.expiresIn * 1000;
  refreshToken = session.refreshToken;
  mode = session.user.mode;
}

async function forget() {
  accessToken = null;
  accessTokenExpiresAt = 0;
  refreshToken = null;
  mode = 'OWNER';
  await deleteRefreshToken();
  setStatus('signedOut');
}
