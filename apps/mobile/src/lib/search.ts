import {
  useCaregiversSearch,
  type SearchCaregiversRequest,
  type ServiceCode,
} from '@pawie/api-client';
import { keepPreviousData } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { atLocalTime } from './format';
import { getSessionStatus, subscribeSession } from './session';

/** What the owner is looking for. Buscar sets it, and Perfil and Reservar read it. */
export type Search = {
  petIds: string[];
  serviceCode: ServiceCode;
  /** ISO date in San Salvador. For an overnight stay, the night that starts that day. */
  day: string;
  /** Start of the visit, in minutes from midnight. An overnight stay ignores it. */
  minute: number;
  districtId: string;
};

let current: Search | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSearch(): Search | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function setSearch(next: Search): void {
  current = next;
  listeners.forEach((listener) => listener());
}

// Nothing of one account may show up after another signs in.
subscribeSession(() => {
  if (getSessionStatus() === 'signedOut') current = null;
});

/** The body of POST /v1/caregivers/search. */
export function toSearchRequest(search: Search): SearchCaregiversRequest {
  const { serviceCode, petIds, districtId, day, minute } = search;
  return serviceCode === 'OVERNIGHT_STAY'
    ? { serviceCode, petIds, districtId, nights: [day] }
    : { serviceCode, petIds, districtId, visits: [atLocalTime(day, minute)] };
}

const NO_SEARCH: SearchCaregiversRequest = {
  serviceCode: 'HOME_VISIT',
  petIds: [],
  districtId: '',
};

/** The caregivers of the search. Buscar, Perfil and Reservar share them through the query cache. */
export function useSearchResults(search: Search | null) {
  return useCaregiversSearch(search ? toSearchRequest(search) : NO_SEARCH, {
    query: { enabled: search !== null, placeholderData: keepPreviousData },
  });
}
