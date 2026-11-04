import type { ServiceCode } from '@pawie/api-client';

import type { IconName } from '@/components/icons.generated';

import type { ColorName } from './tokens';

/**
 * Each service always has the same color and icon, in the search, the bookings and the prices.
 * Those colors mark services and nothing else.
 */
export const services = {
  WALK: { color: 'paseo', icon: 'footprints' },
  HOME_VISIT: { color: 'visita', icon: 'house' },
  OVERNIGHT_STAY: { color: 'pernocta', icon: 'moon' },
} as const satisfies Record<ServiceCode, { color: ColorName; icon: IconName }>;
