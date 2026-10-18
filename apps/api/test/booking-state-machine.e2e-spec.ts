import type { HttpException } from '@nestjs/common';
import { BookingStateMachine } from '../src/bookings/booking-state-machine.js';
import { BOOKING_TRANSITIONS, blocksCalendar } from '../src/bookings/booking-status.js';
import { BookingStatus } from '../src/generated/prisma/client.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import {
  type Catalog,
  createBooking,
  createCaregiver,
  createCatalog,
  svTime,
} from './factories.js';

const VISIT = { startsAt: svTime('2026-11-02T10:00'), endsAt: svTime('2026-11-02T11:00') };
const PAYMENT_DUE_AT = svTime('2026-11-01T12:00');

const TRANSITIONS = Object.entries(BOOKING_TRANSITIONS).flatMap(([from, targets]) =>
  targets.map((to) => [from as BookingStatus, to] as const),
);

async function errorCodeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return ((error as HttpException).getResponse() as { errorCode: string }).errorCode;
  }
  throw new Error('Expected the transition to fail');
}

describe('BookingStateMachine (docs/arquitectura.md §4.7)', () => {
  let db: TestDatabase;
  let catalog: Catalog;
  let machine: BookingStateMachine;

  beforeAll(async () => {
    db = await createTestDatabase();
    catalog = await createCatalog(db.prisma);
    machine = new BookingStateMachine(db.prisma);
  });

  afterAll(async () => {
    await db.close();
  });

  async function bookingIn(status: BookingStatus) {
    const caregiver = await createCaregiver(db.prisma);
    return createBooking(db.prisma, catalog, {
      caregiverId: caregiver.userId,
      slots: [VISIT],
      status,
    });
  }

  const historyOf = (bookingId: string) =>
    db.prisma.bookingStatusChange.findMany({ where: { bookingId } });

  it.each(TRANSITIONS)(
    '%s → %s changes the status and the calendar together, and records it',
    async (from, to) => {
      const booking = await bookingIn(from);

      const changed = await machine.transition(booking.id, {
        from,
        to,
        changedById: booking.ownerId,
        reason: 'Prueba',
        paymentDueAt: PAYMENT_DUE_AT,
      });

      expect(changed).toMatchObject({ status: to, blocksCalendar: blocksCalendar(to) });
      const slots = await db.prisma.bookingSlot.findMany({ where: { bookingId: booking.id } });
      expect(slots.map((slot) => slot.blocksCalendar)).toEqual([blocksCalendar(to)]);
      expect(await historyOf(booking.id)).toMatchObject([
        { fromStatus: from, toStatus: to, changedById: booking.ownerId, reason: 'Prueba' },
      ]);
    },
  );

  it('rejects a transition the table does not allow, and changes nothing', async () => {
    const booking = await bookingIn(BookingStatus.CONFIRMED);

    const errorCode = await errorCodeOf(
      machine.transition(booking.id, {
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.CANCELLED_BY_OWNER,
        changedById: booking.ownerId,
      }),
    );

    expect(errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(await db.prisma.booking.findUnique({ where: { id: booking.id } })).toMatchObject({
      status: BookingStatus.CONFIRMED,
    });
    expect(await historyOf(booking.id)).toEqual([]);
  });

  it('lets only one of two simultaneous changes through', async () => {
    const booking = await bookingIn(BookingStatus.PENDING_PAYMENT);
    const from = BookingStatus.PENDING_PAYMENT;

    const results = await Promise.allSettled([
      machine.transition(booking.id, { from, to: BookingStatus.EXPIRED, changedById: null }),
      machine.transition(booking.id, {
        from,
        to: BookingStatus.CANCELLED_BY_OWNER,
        changedById: booking.ownerId,
      }),
    ]);

    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(await errorCodeOf(Promise.reject(rejected[0].reason))).toBe('BOOKING_STATUS_CHANGED');
    expect(await historyOf(booking.id)).toHaveLength(1);
  });

  it('answers SLOT_TAKEN when a late payment finds the time taken, and changes nothing', async () => {
    const booking = await bookingIn(BookingStatus.EXPIRED);
    await createBooking(db.prisma, catalog, { caregiverId: booking.caregiverId, slots: [VISIT] });

    const errorCode = await errorCodeOf(
      machine.transition(booking.id, {
        from: BookingStatus.EXPIRED,
        to: BookingStatus.CONFIRMED,
        changedById: null,
      }),
    );

    expect(errorCode).toBe('SLOT_TAKEN');
    expect(await db.prisma.booking.findUnique({ where: { id: booking.id } })).toMatchObject({
      status: BookingStatus.EXPIRED,
      blocksCalendar: false,
    });
    expect(await historyOf(booking.id)).toEqual([]);
  });

  it("runs inside the caller's transaction when given one", async () => {
    const booking = await bookingIn(BookingStatus.PENDING_PAYMENT);

    await expect(
      db.prisma.$transaction(async (tx) => {
        await machine.transition(
          booking.id,
          { from: BookingStatus.PENDING_PAYMENT, to: BookingStatus.CONFIRMED, changedById: null },
          tx,
        );
        throw new Error('Something else in the transaction failed');
      }),
    ).rejects.toThrow('Something else in the transaction failed');

    expect(await db.prisma.booking.findUnique({ where: { id: booking.id } })).toMatchObject({
      status: BookingStatus.PENDING_PAYMENT,
    });
    expect(await historyOf(booking.id)).toEqual([]);
  });
});
