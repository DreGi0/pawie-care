import { ApiError, configureApiClient } from '@pawie/api-client';
import { focusManager, QueryCache, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { apiBaseUrl } from './config';
import { getAccessToken, getSessionStatus, signOut, subscribeSession } from './session';

configureApiClient({ baseUrl: apiBaseUrl, getAccessToken });

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // The token is renewed before every request, so a 401 means the API revoked the session.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) void signOut();
    },
  }),
  defaultOptions: {
    queries: {
      // Asking again won't change a 4xx.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});

// Nothing of one account may show up after another signs in.
subscribeSession(() => {
  if (getSessionStatus() === 'signedOut') queryClient.clear();
});

// Refetch stale data when the app comes back to the foreground, such as after paying in Wompi.
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) =>
    setFocused(state === 'active'),
  );
  return () => subscription.remove();
});
