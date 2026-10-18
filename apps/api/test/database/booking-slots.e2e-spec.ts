import { BookingStatus } from '../../src/generated/prisma/client.js';
import { createTestDatabase, type TestDatabase } from '../database.js';
import {
  type Catalog,
  changeStatus,
  createBooking,
  createCaregiver,
  createCatalog,
  svTime,
} from '../factories.js';

// RN-CUI-15: a caregiver can't have slots that overlap. Enforced by the exclusion
// constraint booking_slots_no_overlap, which only looks at slots whose booking blocks
// the calendar.
describe('booking slots', () => {
  let db: TestDatabase;
  let catalog: Catalog;

  beforeAll(async () => {
    db = await createTestDatabase();
    catalog = await createCatalog(db.prisma);
  });

  afterAll(async () => {
    await db.close();
  });

  const visit = (from: string, to: string) => ({
    startsAt: svTime(`2026-11-02T${from}`),
    endsAt: svTime(`2026-11-02T${to}`),
  });

  async function bookedCaregiver(status: BookingStatus = BookingStatus.CONFIRMED) {
    const caregiver = await createCaregiver(db.prisma);
    const booking = await createBooking(db.prisma, catalog, {
      caregiverId: caregiver.userId,
      slots: [visit('10:00', '11:00')],
      status,
    });
    return { caregiverId: caregiver.userId, booking };
  }

  it('rejects a slot that overlaps a blocking slot of the same caregiver', async () => {
    const { caregiverId } = await bookedCaregiver();

    await expect(
      createBooking(db.prisma, catalog, { caregiverId, slots: [visit('10:30', '11:30')] }),
    ).rejects.toThrow(/booking_slots_no_overlap/);
  });

  it('blocks the time from the moment the booking is requested', async () => {
    const { caregiverId } = await bookedCaregiver(BookingStatus.REQUESTED);

    await expect(
      createBooking(db.prisma, catalog, { caregiverId, slots: [visit('10:00', '11:00')] }),
    ).rejects.toThrow(/booking_slots_no_overlap/);
  });

  it('rejects overlapping slots inside one booking', async () => {
    const caregiver = await createCaregiver(db.prisma);

    await expect(
      createBooking(db.prisma, catalog, {
        caregiverId: caregiver.userId,
        slots: [visit('10:00', '11:00'), visit('10:59', '12:00')],
      }),
    ).rejects.toThrow(/booking_slots_no_overlap/);
  });

  it('allows a slot that starts exactly when another one ends', async () => {
    const { caregiverId } = await bookedCaregiver();

    await expect(
      createBooking(db.prisma, catalog, { caregiverId, slots: [visit('11:00', '12:00')] }),
    ).resolves.toBeDefined();
  });

  it('allows the same time for another caregiver', async () => {
    await bookedCaregiver();
    const other = await createCaregiver(db.prisma);

    await expect(
      createBooking(db.prisma, catalog, {
        caregiverId: other.userId,
        slots: [visit('10:00', '11:00')],
      }),
    ).resolves.toBeDefined();
  });

  it('frees the time once the booking stops blocking the calendar', async () => {
    const { caregiverId, booking } = await bookedCaregiver(BookingStatus.PENDING_PAYMENT);

    const expired = await changeStatus(db.prisma, booking.id, BookingStatus.EXPIRED);

    expect(expired.slots.map((slot) => slot.blocksCalendar)).toEqual([false]);
    await expect(
      createBooking(db.prisma, catalog, { caregiverId, slots: [visit('10:00', '11:00')] }),
    ).resolves.toBeDefined();
  });

  it('refuses to bring a booking back when its time was taken in the meantime', async () => {
    // A payment approved after the deadline: the booking can only be confirmed if the
    // slot is still free.
    const { caregiverId, booking } = await bookedCaregiver(BookingStatus.PENDING_PAYMENT);
    await changeStatus(db.prisma, booking.id, BookingStatus.EXPIRED);
    await createBooking(db.prisma, catalog, { caregiverId, slots: [visit('10:00', '11:00')] });

    await expect(changeStatus(db.prisma, booking.id, BookingStatus.CONFIRMED)).rejects.toThrow(
      /booking_slots_no_overlap/,
    );
  });

  it('ties blocks_calendar to the status of the booking', async () => {
    const { booking } = await bookedCaregiver();

    await expect(
      db.prisma.booking.update({ where: { id: booking.id }, data: { blocksCalendar: false } }),
    ).rejects.toThrow(/bookings_blocks_calendar_check/);
    await expect(
      db.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED_BY_OWNER },
      }),
    ).rejects.toThrow(/bookings_blocks_calendar_check/);
  });

  it("keeps each slot's caregiver and blocks_calendar equal to its booking's", async () => {
    const { booking } = await bookedCaregiver();
    const other = await createCaregiver(db.prisma);
    const [slot] = booking.slots;

    await expect(
      db.prisma.bookingSlot.update({
        where: { id: slot.id },
        data: { caregiverId: other.userId },
      }),
    ).rejects.toThrow(/booking_slots_booking_id_caregiver_id_blocks_calendar_fkey/);
    await expect(
      db.prisma.bookingSlot.update({ where: { id: slot.id }, data: { blocksCalendar: false } }),
    ).rejects.toThrow(/booking_slots_booking_id_caregiver_id_blocks_calendar_fkey/);
  });

  it('rejects a slot that ends before it starts', async () => {
    const { booking } = await bookedCaregiver();

    await expect(
      db.prisma.bookingSlot.update({
        where: { id: booking.slots[0].id },
        data: { endsAt: svTime('2026-11-02T09:00') },
      }),
    ).rejects.toThrow(/booking_slots_dates_check/);
  });
});
