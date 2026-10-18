import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  BOOKING_DEADLINES_QUEUE,
  BookingDeadlines,
  type ExpireJobData,
  SWEEP_JOB,
} from '../src/bookings/booking-deadlines.js';
import { BookingStateMachine } from '../src/bookings/booking-state-machine.js';
import { BookingsService } from '../src/bookings/bookings.service.js';
import { addDays, dateInElSalvador, formatDateOnly } from '../src/common/time/calendar.js';
import { Clock } from '../src/common/time/clock.js';
import { BookingStatus, Role } from '../src/generated/prisma/client.js';
import { seedDatabase } from '../src/seed/seed-database.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { createUser } from './factories.js';
import { TestClock } from './test-clock.js';
import { useApi } from './use-api.js';

const HOUR_MS = 60 * 60 * 1000;

/** A visit at least four days ahead: more than 72 h, so the caregiver gets 24 h (RN-RES-06). */
const visitOn = (n: number) =>
  `${formatDateOnly(addDays(dateInElSalvador(new Date()), 4 + n))}T10:00:00-06:00`;

describe('booking deadlines (docs/arquitectura.md §4.10)', () => {
  let db: TestDatabase;
  let carlos: string;
  const clock = new TestClock();

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.prisma, new SettingsService(db.prisma));
    carlos = (
      await db.prisma.user.findFirstOrThrow({
        where: { firstName: 'Carlos', roles: { has: Role.CAREGIVER } },
      })
    ).id;
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db, {
    override: (builder) => builder.overrideProvider(Clock).useValue(clock),
  });

  afterEach(async () => {
    clock.reset();
    await setInstantBooking(true);
  });

  const queue = () => api.app().get<Queue<ExpireJobData>>(getQueueToken(BOOKING_DEADLINES_QUEUE));

  const setInstantBooking = (instantBooking: boolean) =>
    db.prisma.caregiverProfile.update({ where: { userId: carlos }, data: { instantBooking } });

  /** A home visit with Carlos, booked by a new owner in Santa Tecla at the clock's time. */
  async function book(visit: string) {
    const owner = await createUser(db.prisma);
    const district = await db.prisma.district.findUniqueOrThrow({ where: { slug: 'santa-tecla' } });
    const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
    const address = await db.prisma.address.create({
      data: { userId: owner.id, label: 'Casa', street: 'Calle 1', districtId: district.id },
    });
    const pet = await db.prisma.pet.create({
      data: {
        ownerId: owner.id,
        speciesId: dog.id,
        name: 'Toby',
        birthDate: new Date('2019-01-01'),
        sex: 'MALE',
      },
    });
    const { body } = await api
      .http()
      .post('/v1/bookings')
      .auth(await api.tokenFor(owner), { type: 'bearer' })
      .send({
        caregiverId: carlos,
        serviceCode: 'HOME_VISIT',
        visits: [visit],
        petIds: [pet.id],
        addressId: address.id,
        emergency: {
          contactName: 'Luis Pérez',
          contactPhone: '+503 7000 0000',
          preauthorizedCents: 5000,
          clinicConsent: true,
        },
      })
      .expect(201);
    return body as { id: string; status: BookingStatus; ownerId: string };
  }

  async function jobOf(bookingId: string, status: BookingStatus) {
    const job = await queue().getJob(`${bookingId}-${status}`);
    if (!job) {
      throw new Error(`No deadline job for ${bookingId} in ${status}`);
    }
    return job;
  }

  /** Runs the job now, as if its delay were over, and waits until the worker is done with it. */
  async function runNow(bookingId: string, status: BookingStatus) {
    const job = await jobOf(bookingId, status);
    await job.promote();
    // Completed jobs are removed (removeOnComplete).
    await vi.waitFor(
      async () => {
        expect(await queue().getJob(job.id ?? '')).toBeUndefined();
      },
      { timeout: 10_000, interval: 50 },
    );
  }

  const bookingRow = (id: string) =>
    db.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { statusChanges: { orderBy: { createdAt: 'asc' } }, slots: true },
    });

  it('expires a booking that is not paid in time (RN-RES-07)', async () => {
    const start = new Date();
    clock.set(start);
    const booking = await book(visitOn(0));

    const job = await jobOf(booking.id, BookingStatus.PENDING_PAYMENT);
    expect(await job.getState()).toBe('delayed');
    expect(job.opts.delay).toBe(2 * HOUR_MS);

    clock.set(new Date(start.getTime() + 2 * HOUR_MS));
    await runNow(booking.id, BookingStatus.PENDING_PAYMENT);

    const row = await bookingRow(booking.id);
    expect(row).toMatchObject({ status: 'EXPIRED', blocksCalendar: false });
    expect(row.slots.map(({ blocksCalendar }) => blocksCalendar)).toEqual([false]);
    expect(row.statusChanges.at(-1)).toMatchObject({
      fromStatus: 'PENDING_PAYMENT',
      toStatus: 'EXPIRED',
      changedById: null,
      reason: 'RN-RES-07: el dueño no pagó a tiempo.',
    });
  });

  it('expires a request the caregiver does not answer in time (RN-RES-06)', async () => {
    await setInstantBooking(false);
    const start = new Date();
    clock.set(start);
    const booking = await book(visitOn(1));

    const job = await jobOf(booking.id, BookingStatus.REQUESTED);
    expect(job.opts.delay).toBe(24 * HOUR_MS);

    clock.set(new Date(start.getTime() + 24 * HOUR_MS));
    await runNow(booking.id, BookingStatus.REQUESTED);

    expect((await bookingRow(booking.id)).statusChanges.at(-1)).toMatchObject({
      fromStatus: 'REQUESTED',
      toStatus: 'EXPIRED',
      reason: 'RN-RES-06: el cuidador no respondió a tiempo.',
    });
  });

  it('gives an accepted request its payment deadline', async () => {
    await setInstantBooking(false);
    const start = new Date();
    clock.set(start);
    const booking = await book(visitOn(2));

    clock.set(new Date(start.getTime() + HOUR_MS));
    await api.app().get(BookingsService).accept(carlos, booking.id);

    const job = await jobOf(booking.id, BookingStatus.PENDING_PAYMENT);
    expect(job.opts.delay).toBe(2 * HOUR_MS);
    // The request's own deadline finds it already answered.
    clock.set(new Date(start.getTime() + 24 * HOUR_MS));
    await runNow(booking.id, BookingStatus.REQUESTED);
    expect((await bookingRow(booking.id)).status).toBe('PENDING_PAYMENT');
  });

  it('checks the booking again before acting: a paid or cancelled one stays as it is', async () => {
    const start = new Date();
    clock.set(start);
    const paid = await book(visitOn(3));
    const cancelled = await book(
      new Date(new Date(visitOn(3)).getTime() + 2 * HOUR_MS).toISOString(),
    );
    await api.app().get(BookingStateMachine).transition(paid.id, {
      from: BookingStatus.PENDING_PAYMENT,
      to: BookingStatus.CONFIRMED,
      changedById: null,
    });
    await api
      .app()
      .get(BookingsService)
      .cancel((await bookingRow(cancelled.id)).ownerId, cancelled.id);

    clock.set(new Date(start.getTime() + 3 * HOUR_MS));
    await runNow(paid.id, BookingStatus.PENDING_PAYMENT);
    await runNow(cancelled.id, BookingStatus.PENDING_PAYMENT);

    expect((await bookingRow(paid.id)).status).toBe('CONFIRMED');
    expect((await bookingRow(cancelled.id)).status).toBe('CANCELLED_BY_OWNER');
  });

  it('leaves a booking alone when its job runs before the deadline', async () => {
    const booking = await book(visitOn(4));

    await runNow(booking.id, BookingStatus.PENDING_PAYMENT);

    expect((await bookingRow(booking.id)).status).toBe('PENDING_PAYMENT');
  });

  it('sweeps every 5 minutes for overdue bookings whose job got lost', async () => {
    const start = new Date();
    clock.set(start);
    const booking = await book(visitOn(5));
    await (await jobOf(booking.id, BookingStatus.PENDING_PAYMENT)).remove();

    const deadlines = api.app().get(BookingDeadlines);
    const early = await deadlines.expireOverdue();
    clock.set(new Date(start.getTime() + 2 * HOUR_MS));
    const due = await deadlines.expireOverdue();

    // Other tests of this file can leave overdue bookings too.
    expect(early).toBe(0);
    expect(due).toBeGreaterThanOrEqual(1);
    expect((await bookingRow(booking.id)).status).toBe('EXPIRED');
    await vi.waitFor(async () => {
      expect(await queue().getJobSchedulers()).toEqual([
        expect.objectContaining({ key: SWEEP_JOB, every: 5 * 60_000 }),
      ]);
    });
  });

  it('leaves no finished jobs behind in Redis', async () => {
    // The sweep ran once when the app started, and every test above ran expire jobs.
    expect(await queue().getJobCounts('completed', 'failed')).toEqual({ completed: 0, failed: 0 });
  });
});
