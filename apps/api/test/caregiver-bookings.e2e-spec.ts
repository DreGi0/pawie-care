import { BookingStateMachine } from '../src/bookings/booking-state-machine.js';
import { addDays, dateInElSalvador, formatDateOnly } from '../src/common/time/calendar.js';
import { Clock } from '../src/common/time/clock.js';
import { BookingStatus, Role } from '../src/generated/prisma/client.js';
import { seedDatabase } from '../src/seed/seed-database.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { createUser, createVetInstruction } from './factories.js';
import { TestClock } from './test-clock.js';
import { useApi } from './use-api.js';

const HOUR_MS = 60 * 60 * 1000;

/** A date at least three days ahead, so every slot clears the minimum lead time. */
const day = (n: number) => formatDateOnly(addDays(dateInElSalvador(new Date()), 3 + n));
const at = (date: string, time: string) => `${date}T${time}:00-06:00`;

const EMERGENCY = {
  contactName: 'Luis Pérez',
  contactPhone: '+503 7000 0000',
  vetName: 'Clínica San Benito',
  vetPhone: '+503 2222 0000',
  preauthorizedCents: 5000,
  clinicConsent: true,
};

describe("the caregiver's bookings (RN-RES-11)", () => {
  let db: TestDatabase;
  let santaTecla: string;
  const caregivers: Record<string, string> = {};
  const clock = new TestClock();

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.prisma, new SettingsService(db.prisma));
    santaTecla = (await db.prisma.district.findUniqueOrThrow({ where: { slug: 'santa-tecla' } }))
      .id;
    for (const { id, firstName } of await db.prisma.user.findMany({
      where: { roles: { has: Role.CAREGIVER } },
    })) {
      caregivers[firstName] = id;
    }
    // RN-CUI-16: without instant booking, Carlos receives requests.
    await db.prisma.caregiverProfile.update({
      where: { userId: caregivers.Carlos },
      data: { instantBooking: false },
    });
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db, {
    override: (builder) => builder.overrideProvider(Clock).useValue(clock),
  });

  afterEach(() => {
    clock.reset();
  });

  async function client(userId: string) {
    const user = await db.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = await api.tokenFor(user);
    return {
      get: (path: string) => api.http().get(path).auth(token, { type: 'bearer' }),
      post: (path: string, body: object = {}) =>
        api.http().post(path).auth(token, { type: 'bearer' }).send(body),
    };
  }

  /** An owner with a home in Santa Tecla, where Carlos works, and a dog. */
  async function owner() {
    const user = await createUser(db.prisma, [Role.OWNER], {
      createdAt: new Date(Date.now() - 30 * 24 * HOUR_MS),
    });
    const address = await db.prisma.address.create({
      data: {
        userId: user.id,
        label: 'Casa',
        street: 'Calle El Progreso 5, Colonia Utila',
        details: 'Casa esquinera',
        districtId: santaTecla,
      },
    });
    const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
    const pet = (name: string, data: Record<string, unknown> = {}) =>
      db.prisma.pet.create({
        data: {
          ownerId: user.id,
          speciesId: dog.id,
          name,
          birthDate: new Date('2018-01-01'),
          sex: 'FEMALE',
          ...data,
        },
      });
    const toby = await pet('Toby');
    const as = await client(user.id);
    /** A request for a home visit with Carlos. */
    const request = async (visit: string, petIds = [toby.id]) => {
      const { body } = await as
        .post('/v1/bookings', {
          caregiverId: caregivers.Carlos,
          serviceCode: 'HOME_VISIT',
          petIds,
          addressId: address.id,
          emergency: EMERGENCY,
          visits: [visit],
        })
        .expect(201);
      expect(body.status).toBe('REQUESTED');
      return body.id as string;
    };
    return { user, as, pet, request };
  }

  /** RN-PAG-02: the gateway approved the payment of an accepted request. */
  const confirm = (bookingId: string) =>
    api.app().get(BookingStateMachine).transition(bookingId, {
      from: BookingStatus.PENDING_PAYMENT,
      to: BookingStatus.CONFIRMED,
      changedById: null,
    });

  describe('GET /v1/caregivers/me/bookings', () => {
    it('lists the requests first, the one whose answer is due first on top (RN-RES-06)', async () => {
      const { request } = await owner();
      const early = await request(at(day(1), '08:00'));
      const late = await request(at(day(2), '08:00'));
      // The later service has to be answered first.
      await db.prisma.booking.update({
        where: { id: late },
        data: { responseDueAt: new Date(Date.now() + HOUR_MS) },
      });
      await db.prisma.booking.update({
        where: { id: early },
        data: { responseDueAt: new Date(Date.now() + 2 * HOUR_MS) },
      });
      const carlos = await client(caregivers.Carlos);

      const { body } = await carlos.get('/v1/caregivers/me/bookings?status=REQUESTED').expect(200);

      const ids = body.map(({ id }: { id: string }) => id);
      expect(ids.indexOf(late)).toBeLessThan(ids.indexOf(early));
      expect(body.every(({ status }: { status: string }) => status === 'REQUESTED')).toBe(true);
    });

    it('shows a caregiver only their own bookings, and needs caregiver mode', async () => {
      const { user, request } = await owner();
      const bookingId = await request(at(day(1), '10:00'));
      const valeria = await client(caregivers.Valeria);
      const someoneElse = await client(user.id);

      const { body } = await valeria.get('/v1/caregivers/me/bookings').expect(200);
      const theirs = await valeria.get(`/v1/caregivers/me/bookings/${bookingId}`).expect(404);
      const noProfile = await someoneElse.get('/v1/caregivers/me/bookings').expect(404);

      expect(body.map(({ id }: { id: string }) => id)).not.toContain(bookingId);
      expect(theirs.body.errorCode).toBe('BOOKING_NOT_FOUND');
      expect(noProfile.body.errorCode).toBe('CAREGIVER_PROFILE_NOT_FOUND');
    });
  });

  describe('GET /v1/caregivers/me/bookings/:id', () => {
    it('shows the pets with their profile for those dates, heat, Special and what the caregiver gets (RN-RES-11, RN-MAS-11)', async () => {
      const { user, pet, request } = await owner();
      const visit = at(day(4), '10:00');
      const visitDay = new Date(day(4));
      const luna = await pet('Luna', {
        heatStartsOn: addDays(visitDay, -2),
        heatEndsOn: visitDay,
        medications: 'Omega 3 en la comida',
        foodDescription: 'Croquetas Pro Plan',
      });
      const instructions = await createVetInstruction(db.prisma, { id: luna.id, ownerId: user.id });
      const [medication, pastMedication] = await Promise.all(
        [addDays(visitDay, 5), addDays(visitDay, -10)].map((endsOn) =>
          db.prisma.petCareNeed.create({
            data: {
              petId: luna.id,
              task: 'MEDICATION',
              startsOn: new Date('2026-01-01'),
              endsOn,
              vetInstructionId: instructions.id,
            },
          }),
        ),
      );
      await db.prisma.petScheduleItem.createMany({
        data: [
          { petId: luna.id, kind: 'MEAL', minuteOfDay: 420, label: 'Desayuno' },
          {
            petId: luna.id,
            kind: 'MEDICATION',
            minuteOfDay: 480,
            label: 'Antibiótico',
            dose: '1 pastilla',
            careNeedId: medication.id,
          },
          {
            petId: luna.id,
            kind: 'MEDICATION',
            minuteOfDay: 540,
            label: 'Jarabe',
            careNeedId: pastMedication.id,
          },
        ],
      });
      const bookingId = await request(visit, [luna.id]);
      const carlos = await client(caregivers.Carlos);

      const { body } = await carlos.get(`/v1/caregivers/me/bookings/${bookingId}`).expect(200);

      const row = await db.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(body).toMatchObject({
        status: 'REQUESTED',
        serviceCode: 'HOME_VISIT',
        careLevel: 'SPECIAL',
        responseDueAt: row.responseDueAt?.toISOString(),
        district: { slug: 'santa-tecla', name: 'Santa Tecla' },
        // RN-CTA-04: hidden until the booking is confirmed.
        address: null,
        emergency: null,
        slots: [{ serviceCode: 'HOME_VISIT', startsAt: new Date(visit).toISOString() }],
        // RN-PRE-04: the amounts the API saved; the commission is 0%.
        earnings: {
          subtotalCents: row.subtotalCents,
          commissionBp: 0,
          commissionCents: 0,
          payoutCents: row.caregiverPayoutCents,
        },
      });
      expect(body.earnings.payoutCents).toBe(1300);
      const [profile] = body.pets;
      expect(profile).toMatchObject({
        name: 'Luna',
        careLevel: 'SPECIAL',
        inHeat: true,
        foodDescription: 'Croquetas Pro Plan',
        // RN-MAS-02: only data, never a task.
        medications: 'Omega 3 en la comida',
        careNeeds: [{ id: medication.id, task: 'MEDICATION' }],
        vetInstructions: [{ id: instructions.id }],
      });
      // The dose of the task that ended before the visit isn't for this booking (RN-CUI-12).
      expect(profile.scheduleItems.map(({ label }: { label: string }) => label)).toEqual([
        'Desayuno',
        'Antibiótico',
      ]);
    });

    it('is not in heat when the heat does not touch the dates (RN-MAS-11)', async () => {
      const { pet, request } = await owner();
      const visitDay = new Date(day(4));
      const kira = await pet('Kira', {
        heatStartsOn: addDays(visitDay, 1),
        heatEndsOn: addDays(visitDay, 10),
      });
      const bookingId = await request(at(day(4), '14:00'), [kira.id]);
      const carlos = await client(caregivers.Carlos);

      const { body } = await carlos.get(`/v1/caregivers/me/bookings/${bookingId}`).expect(200);

      expect(body.pets[0]).toMatchObject({ careLevel: 'STANDARD', inHeat: false });
    });

    it('shows the address and the emergency details once confirmed (RN-CTA-04)', async () => {
      const { request } = await owner();
      const bookingId = await request(at(day(5), '10:00'));
      const carlos = await client(caregivers.Carlos);
      await carlos.post(`/v1/bookings/${bookingId}/accept`).expect(200);

      const { body: pending } = await carlos.get(`/v1/caregivers/me/bookings/${bookingId}`);
      await confirm(bookingId);
      const { body: confirmed } = await carlos.get(`/v1/caregivers/me/bookings/${bookingId}`);

      expect(pending).toMatchObject({ status: 'PENDING_PAYMENT', address: null, emergency: null });
      expect(confirmed).toMatchObject({
        status: 'CONFIRMED',
        address: { street: 'Calle El Progreso 5, Colonia Utila', details: 'Casa esquinera' },
        emergency: EMERGENCY,
      });
    });
  });

  describe('POST /v1/bookings/:id/accept and /reject', () => {
    it('accepting a request makes it wait for payment, with its deadline (RN-RES-07)', async () => {
      const { as, request } = await owner();
      const visit = at(day(6), '10:00');
      const minutesBefore = (minutes: number) =>
        new Date(new Date(visit).getTime() - minutes * 60_000);
      // Requested 2.5 h before the visit: the caregiver has 1 h to answer (RN-RES-06).
      clock.set(minutesBefore(150));
      const bookingId = await request(visit);
      const carlos = await client(caregivers.Carlos);
      // Accepted 100 minutes before the visit: the payment window ends when it starts.
      clock.set(minutesBefore(100));

      const { body } = await carlos.post(`/v1/bookings/${bookingId}/accept`).expect(200);
      const { body: seenByOwner } = await as.get(`/v1/bookings/${bookingId}`).expect(200);

      expect(body).toMatchObject({
        id: bookingId,
        status: 'PENDING_PAYMENT',
        responseDueAt: null,
        paymentDueAt: new Date(visit).toISOString(),
      });
      expect(seenByOwner.status).toBe('PENDING_PAYMENT');
      const changes = await db.prisma.bookingStatusChange.findMany({ where: { bookingId } });
      expect(changes.at(-1)).toMatchObject({
        fromStatus: 'REQUESTED',
        toStatus: 'PENDING_PAYMENT',
        changedById: caregivers.Carlos,
      });
    });

    it('rejecting a request frees the time, and it cannot be answered again', async () => {
      const { request } = await owner();
      const bookingId = await request(at(day(6), '12:00'));
      const carlos = await client(caregivers.Carlos);

      const { body } = await carlos
        .post(`/v1/bookings/${bookingId}/reject`, { reason: 'Ese día no estoy.' })
        .expect(200);
      const again = await carlos.post(`/v1/bookings/${bookingId}/accept`).expect(409);

      expect(body.status).toBe('REJECTED');
      const row = await db.prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { statusChanges: true },
      });
      expect(row.blocksCalendar).toBe(false);
      expect(row.statusChanges.at(-1)).toMatchObject({
        toStatus: 'REJECTED',
        reason: 'Ese día no estoy.',
      });
      expect(again.body).toMatchObject({
        errorCode: 'BOOKING_NOT_REQUESTED',
        message: 'Esta solicitud ya no espera tu respuesta.',
        details: { status: 'REJECTED' },
      });
    });

    it('cannot be answered after its deadline, even before it expires (RN-RES-06)', async () => {
      const { request } = await owner();
      const bookingId = await request(at(day(6), '14:00'));
      const { responseDueAt } = await db.prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
      });
      clock.set(responseDueAt!);
      const carlos = await client(caregivers.Carlos);

      const late = await carlos.post(`/v1/bookings/${bookingId}/accept`).expect(409);

      expect(late.body.errorCode).toBe('BOOKING_NOT_REQUESTED');
    });

    it("only lets the booking's caregiver answer", async () => {
      const { as, request } = await owner();
      const bookingId = await request(at(day(6), '16:00'));
      const valeria = await client(caregivers.Valeria);

      const byValeria = await valeria.post(`/v1/bookings/${bookingId}/accept`).expect(404);
      const byOwner = await as.post(`/v1/bookings/${bookingId}/reject`).expect(404);

      expect(byValeria.body.errorCode).toBe('BOOKING_NOT_FOUND');
      expect(byOwner.body.errorCode).toBe('BOOKING_NOT_FOUND');
    });
  });

  describe('the agenda', () => {
    const AGENDA =
      '/v1/caregivers/me/bookings?upcoming=true&status=PENDING_PAYMENT&status=CONFIRMED&status=IN_PROGRESS';

    it('shows what is accepted or confirmed, and drops a booking whose payment expired', async () => {
      const { request } = await owner();
      const waiting = await request(at(day(7), '08:00'));
      const paid = await request(at(day(7), '10:00'));
      const unpaid = await request(at(day(7), '12:00'));
      const carlos = await client(caregivers.Carlos);
      for (const id of [waiting, paid, unpaid]) {
        await carlos.post(`/v1/bookings/${id}/accept`).expect(200);
      }
      await confirm(paid);
      // RN-RES-07: the owner didn't pay in time.
      await api.app().get(BookingStateMachine).transition(unpaid, {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.EXPIRED,
        changedById: null,
      });

      const { body } = await carlos.get(AGENDA).expect(200);

      const ids = body.map(({ id }: { id: string }) => id);
      expect(ids).toEqual(expect.arrayContaining([waiting, paid]));
      expect(ids).not.toContain(unpaid);
      expect(ids.indexOf(waiting)).toBeLessThan(ids.indexOf(paid));
    });

    it('leaves out the services that already ended', async () => {
      const { request } = await owner();
      const visit = at(day(8), '10:00');
      const bookingId = await request(visit);
      const carlos = await client(caregivers.Carlos);
      await carlos.post(`/v1/bookings/${bookingId}/accept`).expect(200);
      await confirm(bookingId);

      clock.set(new Date(new Date(visit).getTime() + 2 * HOUR_MS));
      const { body } = await carlos.get(AGENDA).expect(200);

      expect(body.map(({ id }: { id: string }) => id)).not.toContain(bookingId);
    });
  });

  describe('GET /v1/caregivers/me/earnings (RN-PAG-10)', () => {
    it('adds up what is to be paid, and the month by the start of each service', async () => {
      const { request } = await owner();
      const thisMonth = at(day(9), '10:00');
      // 40 days later is always another month.
      const later = at(day(49), '10:00');
      const waiting = at(day(9), '14:00');
      const carlos = await client(caregivers.Carlos);
      const inMonth = new Date(new Date(thisMonth).getTime() - HOUR_MS);
      const read = async () => {
        clock.set(inMonth);
        const { body } = await carlos.get('/v1/caregivers/me/earnings').expect(200);
        clock.reset();
        return body;
      };
      const before = await read();

      const ids = [await request(thisMonth), await request(later), await request(waiting)];
      for (const id of ids) {
        await carlos.post(`/v1/bookings/${id}/accept`).expect(200);
      }
      // The third one is accepted but not paid: it doesn't count yet.
      await confirm(ids[0]);
      await confirm(ids[1]);
      const after = await read();

      expect(after.month).toBe(formatDateOnly(dateInElSalvador(inMonth)).slice(0, 7));
      expect(after.paidCents).toBe(0);
      expect(after.pendingCents - before.pendingCents).toBe(2600);
      expect(after.monthTotalCents - before.monthTotalCents).toBe(1300);
      expect(after.pending).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            bookingId: ids[0],
            status: 'CONFIRMED',
            serviceCode: 'HOME_VISIT',
            petNames: ['Toby'],
            payoutCents: 1300,
          }),
        ]),
      );
      expect(after.pending.map(({ bookingId }: { bookingId: string }) => bookingId)).not.toContain(
        ids[2],
      );
    });
  });
});
