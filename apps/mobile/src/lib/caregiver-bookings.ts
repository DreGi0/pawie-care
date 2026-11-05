import {
  getCaregiverBookingsEarningsQueryKey,
  getCaregiverBookingsGetQueryKey,
  getCaregiverBookingsListQueryKey,
  type CaregiverBookingResponse,
  type CaregiverBookingsListParams,
} from '@pawie/api-client';

import { queryClient } from './api';
import type { StatusTag } from './bookings';
import { formatDeadline } from './format';

/** CuiInicio: the requests that wait for an answer. The API puts the most urgent first. */
export const REQUESTS = { status: ['REQUESTED'] } satisfies CaregiverBookingsListParams;

/**
 * CuiAgenda: what is accepted or confirmed and hasn't ended. An accepted request that the owner
 * doesn't pay in time expires and leaves the agenda (RN-RES-07).
 */
export const AGENDA = {
  upcoming: true,
  status: ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'],
} satisfies CaregiverBookingsListParams;

/** How the caregiver's screens name the state of a booking. */
export function caregiverStatusTag(booking: CaregiverBookingResponse, now = new Date()): StatusTag {
  switch (booking.status) {
    case 'REQUESTED':
      return {
        tone: 'info',
        label: booking.responseDueAt
          ? `Responde ${formatDeadline(booking.responseDueAt, now)}`
          : 'Espera tu respuesta',
      };
    case 'PENDING_PAYMENT':
      return { tone: 'warning', label: 'Esperando el pago' };
    case 'CONFIRMED':
      return { tone: 'success', label: 'Confirmada' };
    case 'IN_PROGRESS':
      return { tone: 'success', label: 'En curso' };
    case 'COMPLETED':
    case 'CLOSED':
      return { tone: 'success', label: 'Completada' };
    case 'REJECTED':
      return { tone: 'error', label: 'La rechazaste' };
    case 'EXPIRED':
      return { tone: 'error', label: 'Venció' };
    case 'CANCELLED_BY_OWNER':
      return { tone: 'error', label: 'El dueño la canceló' };
    case 'CANCELLED_BY_CAREGIVER':
      return { tone: 'error', label: 'La cancelaste' };
    case 'DISPUTED':
      return { tone: 'warning', label: 'En revisión' };
  }
}

/** After an answer: the booking's new state, and the lists and earnings that change with it. */
export function caregiverBookingChanged(booking: CaregiverBookingResponse): void {
  queryClient.setQueryData(getCaregiverBookingsGetQueryKey(booking.id), booking);
  void queryClient.invalidateQueries({ queryKey: getCaregiverBookingsListQueryKey() });
  void queryClient.invalidateQueries({ queryKey: getCaregiverBookingsEarningsQueryKey() });
}
