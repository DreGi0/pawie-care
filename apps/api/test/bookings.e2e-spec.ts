import { BookingStateMachine } from '../src/bookings/booking-state-machine.js';
import { BookingsService } from '../src/bookings/bookings.service.js';
import { CaregiversService } from '../src/caregivers/caregivers.service.js';
import { addDays, dateInElSalvador, formatDateOnly } from '../src/common/time/calendar.js';
import { Clock } from '../src/common/time/clock.js';
import { BookingStatus, type CareTask, Role } from '../src/generated/prisma/client.js';
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

describe('bookings', () => {
  let db: TestDatabase;
  const districts: Record<string, string> = {};
  const caregivers: Record<string, string> = {};
  const clock = new TestClock();

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.prisma, new SettingsService(db.prisma));
    for (const { slug, id } of await db.prisma.district.findMany()) {
      districts[slug] = id;
    }
    for (const { id, firstName } of await db.prisma.user.findMany({
      where: { roles: { has: Role.CAREGIVER } },
    })) {
      caregivers[firstName] = id;
    }
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

  /** A new owner with a home in Santa Tecla, where Carlos works every day. */
  async function owner(district = 'santa-tecla') {
    const user = await createUser(db.prisma);
    const address = await db.prisma.address.create({
      data: {
        userId: user.id,
        label: 'Casa',
        street: 'Calle El Progreso 5, Colonia Utila',
        details: 'Casa esquinera',
        districtId: districts[district],
      },
    });
    const token = await api.tokenFor(user);
    const as = {
      get: (path: string) => api.http().get(path).auth(token, { type: 'bearer' }),
      post: (path: string, body: object = {}) =>
        api.http().post(path).auth(token, { type: 'bearer' }).send(body),
      put: (path: string, body: object) =>
        api.http().put(path).auth(token, { type: 'bearer' }).send(body),
    };

    async function pet(
      name = 'Toby',
      needs: {
        task: CareTask;
        ownerInstructions?: string;
        vetInstructionId?: string;
        endsOn?: Date;
      }[] = [],
    ) {
      const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
      const created = await db.prisma.pet.create({
        data: {
          ownerId: user.id,
          speciesId: dog.id,
          name,
          birthDate: new Date('2018-01-01'),
          sex: 'MALE',
        },
      });
      await db.prisma.petCareNeed.createMany({
        data: needs.map((need) => ({
          petId: created.id,
          startsOn: new Date('2026-01-01'),
          ...need,
        })),
      });
      return created.id;
    }

    /** A home visit with Carlos, unless the body says otherwise. */
    const toby = await pet();
    const book = (body: Record<string, unknown>) =>
      as.post('/v1/bookings', {
        caregiverId: caregivers.Carlos,
        serviceCode: 'HOME_VISIT',
        petIds: [toby],
        addressId: address.id,
        emergency: EMERGENCY,
        ...body,
      });

    return { user, address, as, pet, book };
  }

  const bookingRow = (id: string) =>
    db.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { slots: { orderBy: { startsAt: 'asc' } }, statusChanges: true, pets: true },
    });

  describe('POST /v1/bookings', () => {
    it('books a caregiver with instant booking, who then waits for payment (RN-CUI-16, RN-RES-07)', async () => {
      const { user, as, pet, book } = await owner();
      const now = new Date(Date.now() - 60_000);
      clock.set(now);
      const toby = await pet();
      const visit = at(day(0), '10:00');

      const search = await as
        .post('/v1/caregivers/search', {
          petIds: [toby],
          serviceCode: 'HOME_VISIT',
          visits: [visit],
          districtId: districts['santa-tecla'],
        })
        .expect(200);
      const found = search.body.results.find(({ id }: { id: string }) => id === caregivers.Carlos);
      const { body } = await book({ petIds: [toby], visits: [visit] }).expect(201);

      expect(body).toMatchObject({
        status: 'PENDING_PAYMENT',
        serviceCode: 'HOME_VISIT',
        careLevel: 'STANDARD',
        startsAt: new Date(visit).toISOString(),
        endsAt: new Date(new Date(visit).getTime() + HOUR_MS).toISOString(),
        responseDueAt: null,
        paymentDueAt: new Date(now.getTime() + 2 * HOUR_MS).toISOString(),
        caregiver: { id: caregivers.Carlos, displayName: 'Carlos H.', phone: null },
        pets: [{ id: toby, name: 'Toby', careLevel: 'STANDARD', vetInstructionIds: [] }],
        slots: [{ serviceCode: 'HOME_VISIT', unitPriceCents: 1200, subtotalCents: 1200 }],
        address: { street: 'Calle El Progreso 5, Colonia Utila', details: 'Casa esquinera' },
        emergency: EMERGENCY,
        price: { subtotalCents: 1200, serviceFeeBp: 1000, serviceFeeCents: 120, totalCents: 1320 },
      });
      // The booking charges what the search showed.
      expect(found.prices).toEqual([
        { serviceCode: 'HOME_VISIT', careLevel: 'STANDARD', priceCents: 1200 },
      ]);
      expect((await bookingRow(body.id)).statusChanges).toMatchObject([
        { fromStatus: null, toStatus: 'PENDING_PAYMENT', changedById: user.id },
      ]);
    });

    it('sends a request to a caregiver without instant booking (RN-RES-06)', async () => {
      const { book } = await owner();
      const visit = at(day(1), '10:00');
      // 48 h before the visit: the middle window, 6 h.
      const now = new Date(new Date(visit).getTime() - 48 * HOUR_MS);
      clock.set(now);
      await db.prisma.caregiverProfile.update({
        where: { userId: caregivers.Carlos },
        data: { instantBooking: false },
      });

      try {
        const { body } = await book({ visits: [visit] }).expect(201);

        expect(body).toMatchObject({
          status: 'REQUESTED',
          responseDueAt: new Date(now.getTime() + 6 * HOUR_MS).toISOString(),
          paymentDueAt: null,
        });
      } finally {
        await db.prisma.caregiverProfile.update({
          where: { userId: caregivers.Carlos },
          data: { instantBooking: true },
        });
      }
    });

    it('saves the prices of the example of RN-PRE: a $17 Special visit (RN-PRE-07)', async () => {
      const { pet, book } = await owner();
      const nala = await pet('Nala', [
        { task: 'MOBILITY_ASSISTANCE', ownerInstructions: 'Ayudarla a subir al sofá.' },
      ]);

      const { body } = await book({ petIds: [nala], visits: [at(day(2), '10:00')] }).expect(201);

      // Carlos didn't set a Special visit price, so the suggested $17 applies.
      expect(await bookingRow(body.id)).toMatchObject({
        careLevel: 'SPECIAL',
        subtotalCents: 1700,
        ownerServiceFeeBp: 1000,
        ownerServiceFeeCents: 170,
        totalCents: 1870,
        caregiverCommissionBp: 1500,
        caregiverCommissionCents: 255,
        caregiverPayoutCents: 1445,
        additionalPetSurchargeBp: 5000,
        guaranteeFundBp: 200,
        vatBp: 1300,
        gatewayFeeBp: 350,
        pricingSnapshot: {
          version: 1,
          rounding: 'HALF_UP_ONCE_PER_AMOUNT',
          careLevel: 'SPECIAL',
          petCount: 1,
          prices: [
            {
              serviceCode: 'HOME_VISIT',
              caregiverPriceCents: null,
              range: { minCents: 1500, suggestedCents: 1700, maxCents: 2000 },
              unitPriceCents: 1700,
            },
          ],
        },
        slots: [{ unitPriceCents: 1700, subtotalCents: 1700 }],
        pets: [{ petId: nala, careLevel: 'SPECIAL' }],
      });
    });

    it('adds 50% per additional pet and prices the visits of a stay as visits (RN-PRE-02, RN-SER-03)', async () => {
      const { pet, book } = await owner();
      const petIds = [await pet('Toby'), await pet('Max')];

      const { body } = await book({
        petIds,
        serviceCode: 'OVERNIGHT_STAY',
        nights: [day(3), day(4)],
        visits: [at(day(4), '13:00')],
      }).expect(201);

      // Nights: 2600 × 1.5 = 3900. The visit: 1200 × 1.5 = 1800.
      expect(body.slots).toMatchObject([
        { serviceCode: 'OVERNIGHT_STAY', unitPriceCents: 2600, subtotalCents: 3900 },
        { serviceCode: 'HOME_VISIT', unitPriceCents: 1200, subtotalCents: 1800 },
        { serviceCode: 'OVERNIGHT_STAY', unitPriceCents: 2600, subtotalCents: 3900 },
      ]);
      expect(await bookingRow(body.id)).toMatchObject({
        subtotalCents: 9600,
        ownerServiceFeeCents: 960,
        totalCents: 10_560,
        caregiverCommissionCents: 1440,
        caregiverPayoutCents: 8160,
      });
    });

    it('attaches the vet instructions of the clinical tasks active on its dates (RN-RES-03)', async () => {
      const { user, pet, book } = await owner();
      const rocky = await pet('Rocky');
      const current = await createVetInstruction(db.prisma, { id: rocky, ownerId: user.id });
      const old = await createVetInstruction(db.prisma, { id: rocky, ownerId: user.id });
      await db.prisma.petCareNeed.createMany({
        data: [
          {
            petId: rocky,
            task: 'MEDICATION',
            startsOn: new Date('2026-01-01'),
            endsOn: new Date(day(30)),
            vetInstructionId: current.id,
          },
          {
            petId: rocky,
            task: 'PRESCRIBED_REST',
            startsOn: new Date('2026-01-01'),
            endsOn: new Date(day(30)),
            vetInstructionId: current.id,
          },
          {
            petId: rocky,
            task: 'WOUND_CARE',
            startsOn: new Date('2026-01-01'),
            endsOn: new Date('2026-01-31'),
            vetInstructionId: old.id,
          },
        ],
      });

      const { body } = await book({ petIds: [rocky], visits: [at(day(5), '10:00')] }).expect(201);

      expect(body.careLevel).toBe('SPECIAL');
      expect(body.pets).toEqual([
        { id: rocky, name: 'Rocky', careLevel: 'SPECIAL', vetInstructionIds: [current.id] },
      ]);
    });

    it('keeps a copy of the address (RN-CTA-04)', async () => {
      const { address, as, book } = await owner();
      const { body } = await book({ visits: [at(day(5), '12:00')] }).expect(201);

      await as
        .put(`/v1/addresses/${address.id}`, {
          label: 'Casa',
          street: 'Otra calle 1',
          districtId: districts['santa-tecla'],
        })
        .expect(200);

      expect((await as.get(`/v1/bookings/${body.id}`).expect(200)).body.address).toMatchObject({
        street: 'Calle El Progreso 5, Colonia Utila',
        details: 'Casa esquinera',
        district: { slug: 'santa-tecla' },
      });
    });

    it('turns down what the search would not show', async () => {
      const { pet, book } = await owner();
      const { book: bookFromSoyapango } = await owner('soyapango');
      const stranger = await owner();
      const visits = [at(day(6), '10:00')];

      const noConsent = await book({ visits, emergency: { ...EMERGENCY, clinicConsent: false } });
      const elsewhere = await bookFromSoyapango({ visits });
      const foreignAddress = await book({ visits, addressId: stranger.address.id });
      const prohibited = await book({
        visits,
        petIds: [await pet('Rocky', [{ task: 'INJECTION' }])],
      });
      const soon = await book({ visits: [new Date(Date.now() + 30 * 60_000).toISOString()] });

      expect(noConsent.status).toBe(400);
      expect(noConsent.body.details).toHaveProperty(['emergency.clinicConsent']);
      expect([elsewhere.status, elsewhere.body.errorCode]).toEqual([409, 'CAREGIVER_UNAVAILABLE']);
      expect([foreignAddress.status, foreignAddress.body.errorCode]).toEqual([
        404,
        'ADDRESS_NOT_FOUND',
      ]);
      expect([prohibited.status, prohibited.body.errorCode]).toEqual([422, 'PET_NOT_BOOKABLE']);
      expect([soon.status, soon.body.errorCode]).toEqual([422, 'TOO_SOON']);
    });

    it('does not let a caregiver book themselves (RN-CTA-01)', async () => {
      const carlos = await db.prisma.user.findUniqueOrThrow({ where: { id: caregivers.Carlos } });
      const token = await api.tokenFor(carlos);
      const address = await db.prisma.address.create({
        data: {
          userId: carlos.id,
          label: 'Casa',
          street: 'Calle 1',
          districtId: districts['santa-tecla'],
        },
      });
      const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
      const own = await db.prisma.pet.create({
        data: {
          ownerId: carlos.id,
          speciesId: dog.id,
          name: 'Firulais',
          birthDate: new Date('2020-01-01'),
          sex: 'MALE',
        },
      });

      const response = await api
        .http()
        .post('/v1/bookings')
        .auth(token, { type: 'bearer' })
        .send({
          caregiverId: carlos.id,
          serviceCode: 'HOME_VISIT',
          visits: [at(day(6), '12:00')],
          petIds: [own.id],
          addressId: address.id,
          emergency: EMERGENCY,
        })
        .expect(409);

      expect(response.body.errorCode).toBe('CAREGIVER_UNAVAILABLE');
    });
  });

  describe('the same time twice (RN-CUI-15)', () => {
    it('answers SLOT_TAKEN when the time is already booked', async () => {
      const visits = [at(day(7), '10:00')];
      await (await owner()).book({ visits }).expect(201);

      const response = await (await owner()).book({ visits }).expect(409);

      expect(response.body).toMatchObject({
        errorCode: 'SLOT_TAKEN',
        message:
          'Alguien acaba de reservar ese horario con este cuidador. Elige otro horario o cuidador.',
      });
    });

    it('lets only one of two simultaneous bookings take the time', async () => {
      const visits = [at(day(7), '12:00')];
      const [first, second] = await Promise.all([owner(), owner()]);

      const responses = await Promise.all([first.book({ visits }), second.book({ visits })]);

      expect(responses.map(({ status }) => status).toSorted((a, b) => a - b)).toEqual([201, 409]);
      expect(responses.find(({ status }) => status === 409)?.body.errorCode).toBe('SLOT_TAKEN');
      expect(
        await db.prisma.bookingSlot.count({
          where: { caregiverId: caregivers.Carlos, startsAt: new Date(visits[0]) },
        }),
      ).toBe(1);
    });

    it('turns the exclusion violation into SLOT_TAKEN when the other booking lands after the check', async () => {
      const visits = [at(day(7), '14:00')];
      await (await owner()).book({ visits }).expect(201);
      // As if the first booking had been written right after the second one's check.
      const service = api.app().get(CaregiversService);
      const check = vi.spyOn(service, 'bookableCaregiver').mockResolvedValueOnce({
        caregiverId: caregivers.Carlos,
        instantBooking: true,
        prices: [
          {
            serviceCode: 'HOME_VISIT',
            caregiverPriceCents: null,
            range: { minCents: 1000, suggestedCents: 1200, maxCents: 1400 },
          },
        ],
      });

      try {
        const response = await (await owner()).book({ visits }).expect(409);
        expect(response.body.errorCode).toBe('SLOT_TAKEN');
      } finally {
        check.mockRestore();
      }
    });

    it('stops showing a booked caregiver in the search, and shows them again once cancelled', async () => {
      const { as, pet, book } = await owner();
      const visits = [at(day(8), '10:00')];
      const search = async () => {
        const { body } = await as
          .post('/v1/caregivers/search', {
            petIds: [await pet()],
            serviceCode: 'HOME_VISIT',
            visits,
            districtId: districts['santa-tecla'],
          })
          .expect(200);
        return body.results.map(({ id }: { id: string }) => id);
      };

      const before = await search();
      const { body: booking } = await book({ visits }).expect(201);
      const whileBooked = await search();
      await as.post(`/v1/bookings/${booking.id}/cancel`).expect(200);
      const afterCancelling = await search();

      expect(before).toContain(caregivers.Carlos);
      expect(whileBooked).not.toContain(caregivers.Carlos);
      expect(afterCancelling).toContain(caregivers.Carlos);
    });
  });

  describe('GET /v1/bookings', () => {
    it("lists the owner's bookings, the latest service first, and hides everyone else's", async () => {
      const { as, book } = await owner();
      const { body: early } = await book({ visits: [at(day(9), '08:00')] }).expect(201);
      const { body: late } = await book({ visits: [at(day(10), '08:00')] }).expect(201);
      const stranger = await owner();

      const { body: list } = await as.get('/v1/bookings').expect(200);
      const theirs = await stranger.as.get(`/v1/bookings/${early.id}`).expect(404);

      expect(list.map(({ id }: { id: string }) => id)).toEqual([late.id, early.id]);
      expect((await stranger.as.get('/v1/bookings').expect(200)).body).toEqual([]);
      expect(theirs.body.errorCode).toBe('BOOKING_NOT_FOUND');
    });

    it("shows the caregiver's phone only once the booking is confirmed (RN-CTA-04)", async () => {
      const { as, book } = await owner();
      await db.prisma.user.update({
        where: { id: caregivers.Carlos },
        data: { phone: '+503 7777 0000' },
      });
      const { body: booking } = await book({ visits: [at(day(9), '10:00')] }).expect(201);

      await api.app().get(BookingStateMachine).transition(booking.id, {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CONFIRMED,
        changedById: null,
      });
      const { body: confirmed } = await as.get(`/v1/bookings/${booking.id}`).expect(200);

      expect(booking.caregiver.phone).toBeNull();
      expect(confirmed).toMatchObject({
        status: 'CONFIRMED',
        paymentDueAt: null,
        caregiver: { phone: '+503 7777 0000' },
      });
    });
  });

  describe('POST /v1/bookings/:id/cancel', () => {
    it('cancels at no cost while waiting for payment, and frees the time (RN-CAN-07)', async () => {
      const { user, as, book } = await owner();
      const { body: booking } = await book({ visits: [at(day(11), '10:00')] }).expect(201);

      const { body } = await as
        .post(`/v1/bookings/${booking.id}/cancel`, { reason: 'Cambié de planes.' })
        .expect(200);

      expect(body).toMatchObject({ status: 'CANCELLED_BY_OWNER', paymentDueAt: null });
      const row = await bookingRow(booking.id);
      expect(row.blocksCalendar).toBe(false);
      expect(row.slots.map(({ blocksCalendar }) => blocksCalendar)).toEqual([false]);
      expect(row.statusChanges.at(-1)).toMatchObject({
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'CANCELLED_BY_OWNER',
        changedById: user.id,
        reason: 'Cambié de planes.',
      });
    });

    it('cancels a request that is still waiting for the caregiver', async () => {
      const { as, book } = await owner();
      await db.prisma.caregiverProfile.update({
        where: { userId: caregivers.Carlos },
        data: { instantBooking: false },
      });
      try {
        const { body: booking } = await book({ visits: [at(day(11), '12:00')] }).expect(201);

        const { body } = await as.post(`/v1/bookings/${booking.id}/cancel`).expect(200);

        expect([booking.status, body.status]).toEqual(['REQUESTED', 'CANCELLED_BY_OWNER']);
      } finally {
        await db.prisma.caregiverProfile.update({
          where: { userId: caregivers.Carlos },
          data: { instantBooking: true },
        });
      }
    });

    it('refuses to cancel a booking that is already paid or cancelled', async () => {
      const { as, book } = await owner();
      const { body: paid } = await book({ visits: [at(day(11), '14:00')] }).expect(201);
      await api.app().get(BookingStateMachine).transition(paid.id, {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CONFIRMED,
        changedById: null,
      });
      const { body: cancelled } = await book({ visits: [at(day(11), '16:00')] }).expect(201);
      await as.post(`/v1/bookings/${cancelled.id}/cancel`).expect(200);

      const confirmed = await as.post(`/v1/bookings/${paid.id}/cancel`).expect(409);
      const again = await as.post(`/v1/bookings/${cancelled.id}/cancel`).expect(409);

      expect(confirmed.body).toMatchObject({
        errorCode: 'BOOKING_NOT_CANCELLABLE',
        message: 'Solo se puede cancelar una reserva antes de pagarla.',
        details: { status: 'CONFIRMED' },
      });
      expect(again.body.errorCode).toBe('BOOKING_NOT_CANCELLABLE');
    });
  });

  describe("the caregiver's answer (no route until the caregiver panel)", () => {
    async function request(visit: string) {
      const { book } = await owner();
      await db.prisma.caregiverProfile.update({
        where: { userId: caregivers.Carlos },
        data: { instantBooking: false },
      });
      try {
        const { body } = await book({ visits: [visit] }).expect(201);
        return body.id as string;
      } finally {
        await db.prisma.caregiverProfile.update({
          where: { userId: caregivers.Carlos },
          data: { instantBooking: true },
        });
      }
    }

    it('accepting a request makes it wait for payment, with its deadline', async () => {
      const visit = at(day(12), '10:00');
      const bookingId = await request(visit);
      // 90 minutes before the visit: the payment window ends when the visit starts.
      clock.set(new Date(new Date(visit).getTime() - 90 * 60_000));

      const accepted = await api.app().get(BookingsService).accept(caregivers.Carlos, bookingId);

      expect(accepted).toMatchObject({ status: 'PENDING_PAYMENT', paymentDueAt: new Date(visit) });
      expect((await bookingRow(bookingId)).statusChanges.at(-1)).toMatchObject({
        fromStatus: 'REQUESTED',
        toStatus: 'PENDING_PAYMENT',
        changedById: caregivers.Carlos,
      });
    });

    it('rejecting a request frees the time', async () => {
      const bookingId = await request(at(day(12), '12:00'));

      const rejected = await api.app().get(BookingsService).reject(caregivers.Carlos, bookingId);

      expect(rejected).toMatchObject({ status: 'REJECTED', blocksCalendar: false });
    });

    it('only lets the caregiver of the booking answer', async () => {
      const bookingId = await request(at(day(12), '14:00'));

      await expect(
        api.app().get(BookingsService).accept(caregivers.Valeria, bookingId),
      ).rejects.toThrow('No encontramos esa reserva.');
    });
  });
});
