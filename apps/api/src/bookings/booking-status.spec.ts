import { BookingStatus } from '../generated/prisma/enums.js';
import { BOOKING_TRANSITIONS, blocksCalendar, canTransition } from './booking-status.js';

const {
  REQUESTED,
  PENDING_PAYMENT,
  CONFIRMED,
  REJECTED,
  EXPIRED,
  CANCELLED_BY_OWNER,
  CANCELLED_BY_CAREGIVER,
} = BookingStatus;

// One row per allowed transition, with the rule that allows it.
const ALLOWED = [
  [REQUESTED, PENDING_PAYMENT, 'the caregiver accepts (§8.2)'],
  [REQUESTED, REJECTED, 'the caregiver rejects (§8.2)'],
  [REQUESTED, EXPIRED, 'the caregiver did not answer in time (RN-RES-06)'],
  [REQUESTED, CANCELLED_BY_OWNER, 'the owner cancels at no cost (RN-CAN-07)'],
  [PENDING_PAYMENT, CONFIRMED, 'the gateway approved the payment (RN-PAG-02)'],
  [PENDING_PAYMENT, EXPIRED, 'the owner did not pay in time (RN-RES-07)'],
  [PENDING_PAYMENT, CANCELLED_BY_OWNER, 'the owner cancels at no cost (RN-CAN-07)'],
  [EXPIRED, CONFIRMED, 'a late payment, if the slots are still free'],
] as const;

const STATUSES = Object.values(BookingStatus);

describe('booking transitions', () => {
  it.each(ALLOWED)('allows %s → %s: %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('rejects every other transition', () => {
    const allowed = new Set(ALLOWED.map(([from, to]) => `${from}→${to}`));

    const others = STATUSES.flatMap((from) =>
      STATUSES.filter((to) => !allowed.has(`${from}→${to}`)).map((to) => [from, to] as const),
    );

    expect(others).toHaveLength(STATUSES.length ** 2 - ALLOWED.length);
    expect(others.filter(([from, to]) => canTransition(from, to))).toEqual([]);
  });

  it('lists every status', () => {
    expect(Object.keys(BOOKING_TRANSITIONS).toSorted()).toEqual(STATUSES.toSorted());
  });
});

describe('blocksCalendar', () => {
  it('frees the time only when the booking is rejected, expired or cancelled', () => {
    expect(STATUSES.filter((status) => !blocksCalendar(status)).toSorted()).toEqual(
      [REJECTED, EXPIRED, CANCELLED_BY_OWNER, CANCELLED_BY_CAREGIVER].toSorted(),
    );
  });

  it('holds the time from the moment the owner asks (first come, first served)', () => {
    expect(blocksCalendar(REQUESTED)).toBe(true);
    expect(blocksCalendar(PENDING_PAYMENT)).toBe(true);
  });
});
