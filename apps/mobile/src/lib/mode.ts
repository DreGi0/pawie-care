import { getUsersMeQueryKey, usersUpdate, type AppMode } from '@pawie/api-client';
import { router } from 'expo-router';

import { queryClient } from './api';
import { setMode } from './session';

/** The first tab of each mode (RN-CTA-06). */
export const HOME = { OWNER: '/', CAREGIVER: '/inicio' } as const satisfies Record<AppMode, string>;

/** RN-CTA-06: saves the mode in the account, so the app opens in it next time, and shows its tabs. */
export async function switchMode(mode: AppMode): Promise<void> {
  const me = await usersUpdate({ mode });
  queryClient.setQueryData(getUsersMeQueryKey(), me);
  setMode(mode);
  router.navigate(HOME[mode]);
}
