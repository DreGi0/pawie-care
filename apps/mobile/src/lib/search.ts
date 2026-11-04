import {
  useCaregiversSearch,
  type CaregiverLevel,
  type CatalogResponse,
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
  /** Start of the walk or the visit, in minutes from midnight. An overnight stay ignores it. */
  minute: number;
  districtId: string;
  /** RN-RES-10: the filters. Without them, every caregiver of the search. */
  minLevel?: CaregiverLevel;
  certificationCodes: string[];
  minRating?: number;
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

/** RN-SER-05: whether the service takes the pet's species, as GET /v1/catalog says. */
export function serviceTakes(
  catalog: CatalogResponse,
  serviceCode: ServiceCode,
  pet: { species: { code: string } },
): boolean {
  const service = catalog.services.find(({ code }) => code === serviceCode);
  return service?.speciesCodes.includes(pet.species.code) ?? false;
}

/** The body of POST /v1/caregivers/search. */
export function toSearchRequest(search: Search): SearchCaregiversRequest {
  const { serviceCode, petIds, districtId, day, minute, minLevel, certificationCodes, minRating } =
    search;
  const filters = {
    minLevel,
    minRating,
    certificationCodes: certificationCodes.length > 0 ? certificationCodes : undefined,
  };
  const base = { serviceCode, petIds, districtId, ...filters };
  switch (serviceCode) {
    case 'OVERNIGHT_STAY':
      return { ...base, nights: [day] };
    case 'HOME_VISIT':
      return { ...base, visits: [atLocalTime(day, minute)] };
    case 'WALK':
      return { ...base, walks: [atLocalTime(day, minute)] };
  }
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
