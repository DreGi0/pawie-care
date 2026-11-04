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

/** The order the app always shows services in, as in Main: paseo, visita and pernocta. */
export const SERVICE_ORDER = Object.keys(services) as ServiceCode[];

/** Sorts anything with a serviceCode in SERVICE_ORDER. Hermes has no toSorted, so it copies first. */
export function byServiceOrder<T extends { serviceCode: ServiceCode }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => SERVICE_ORDER.indexOf(a.serviceCode) - SERVICE_ORDER.indexOf(b.serviceCode),
  );
}
