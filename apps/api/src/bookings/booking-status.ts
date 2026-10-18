import { BookingStatus } from '../generated/prisma/enums.js';

const {
  REQUESTED,
  PENDING_PAYMENT,
  CONFIRMED,
  REJECTED,
  EXPIRED,
  CANCELLED_BY_OWNER,
  CANCELLED_BY_CAREGIVER,
} = BookingStatus;

/**
 * Every status change a booking can make (docs/arquitectura.md §4.7), from §8.2 of the
 * rules and the decisions taken for the demo. Any other change is rejected. A booking
 * starts as REQUESTED, or as PENDING_PAYMENT when the caregiver has instant booking
 * (RN-CUI-16).
 *
 * The rest of §8.2 (check-in and check-out, closing, disputes) and the cancellations
 * of a confirmed booking (§10) come after the demo, and add their rows here.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  [REQUESTED]: [
    // The caregiver accepts (§8.2) or rejects.
    PENDING_PAYMENT,
    REJECTED,
    // RN-RES-06: the caregiver didn't answer in time.
    EXPIRED,
    // The owner cancels at no cost before paying.
    CANCELLED_BY_OWNER,
  ],
  [PENDING_PAYMENT]: [
    // RN-PAG-02: the gateway approved the payment.
    CONFIRMED,
    // RN-RES-07: the owner didn't pay in time.
    EXPIRED,
    CANCELLED_BY_OWNER,
  ],
  // A payment approved after the deadline still confirms the booking if its slots are
  // free; if they were taken, the exclusion constraint refuses and the payment is
  // refunded (Etapa 6).
  [EXPIRED]: [CONFIRMED],
  [CONFIRMED]: [],
  [BookingStatus.IN_PROGRESS]: [],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CLOSED]: [],
  [REJECTED]: [],
  [CANCELLED_BY_OWNER]: [],
  [CANCELLED_BY_CAREGIVER]: [],
  [BookingStatus.DISPUTED]: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/** Statuses that free the caregiver's time. The CHECK bookings_blocks_calendar_check repeats them. */
const NON_BLOCKING_STATUSES: readonly BookingStatus[] = [
  REJECTED,
  EXPIRED,
  CANCELLED_BY_OWNER,
  CANCELLED_BY_CAREGIVER,
];

/**
 * Whether a booking in this status holds the caregiver's time (docs/arquitectura.md
 * §4.8). REQUESTED already does: first come, first served.
 */
export function blocksCalendar(status: BookingStatus): boolean {
  return !NON_BLOCKING_STATUSES.includes(status);
}

/** Statuses of a booking that was confirmed and wasn't cancelled. */
const CONFIRMED_STATUSES: readonly BookingStatus[] = [
  CONFIRMED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
  BookingStatus.CLOSED,
  BookingStatus.DISPUTED,
];

/**
 * RN-CTA-04: the caregiver's phone and the owner's address stay hidden from the other
 * side until the booking is confirmed.
 */
export function revealsContact(status: BookingStatus): boolean {
  return CONFIRMED_STATUSES.includes(status);
}
