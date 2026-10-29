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
const DAY_MS = 24 * HOUR_MS;

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

  /**
   * An owner with a home in Santa Tecla, where Carlos works every day. By default they
   * registered a month ago, past the window of the first service without a fee
   * (RN-PRE-09); a newcomer is still inside it.
   */
  async function owner(district = 'santa-tecla', { newcomer = false } = {}) {
    const user = await createUser(db.prisma);
    if (!newcomer) {
      await registeredDaysAgo(user.id, 30);
    }
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
    const request = (body: Record<string, unknown>) => ({
      caregiverId: caregivers.Carlos,
      serviceCode: 'HOME_VISIT',
      petIds: [toby],
      addressId: address.id,
      emergency: EMERGENCY,
      ...body,
    });
    const book = (body: Record<string, unknown>) => as.post('/v1/bookings', request(body));
    // The quote takes the booking's body without the emergency details.
    const quote = (body: Record<string, unknown>) => {
      const { emergency: _emergency, ...rest } = request(body);
      return as.post('/v1/bookings/quote', rest);
    };

    return { user, address, as, pet, book, quote };
  }

  const registeredDaysAgo = (userId: string, days: number) =>
    db.prisma.user.update({
      where: { id: userId },
      data: { createdAt: new Date(Date.now() - days * DAY_MS) },
    });

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
        // Carlos is Pro and set no visit price: the suggested $13 of his level.
        slots: [{ serviceCode: 'HOME_VISIT', unitPriceCents: 1300, subtotalCents: 1300 }],
        address: { street: 'Calle El Progreso 5, Colonia Utila', details: 'Casa esquinera' },
        emergency: EMERGENCY,
        price: {
          subtotalCents: 1300,
          serviceFeeBp: 1500,
          serviceFeeCents: 195,
          totalCents: 1495,
          firstServiceFeeWaived: false,
        },
      });
      // The booking charges what the search showed.
      expect(found.prices).toEqual([{ serviceCode: 'HOME_VISIT', priceCents: 1300 }]);
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

    it('a Special pet needs the ⭐ but does not change the price, and the booking saves its terms (RN-MAS-06, RN-PRE-07)', async () => {
      const { pet, book } = await owner();
      const nala = await pet('Nala', [
        { task: 'MOBILITY_ASSISTANCE', ownerInstructions: 'Ayudarla a subir al sofá.' },
      ]);

      const { body } = await book({ petIds: [nala], visits: [at(day(2), '10:00')] }).expect(201);

      // The same $13 as a Normal pet: Carlos is Pro, and the pet's level doesn't price.
      expect(await bookingRow(body.id)).toMatchObject({
        careLevel: 'SPECIAL',
        caregiverLevel: 'PRO',
        firstServiceFeeWaived: false,
        subtotalCents: 1300,
        ownerServiceFeeBp: 1500,
        ownerServiceFeeCents: 195,
        totalCents: 1495,
        caregiverCommissionBp: 0,
        caregiverCommissionCents: 0,
        caregiverPayoutCents: 1300,
        additionalPetSurchargeBp: 5000,
        guaranteeFundBp: 200,
        vatBp: 1300,
        gatewayFeeBp: 350,
        pricingSnapshot: {
          version: 2,
          rounding: 'HALF_UP_ONCE_PER_AMOUNT',
          caregiverLevel: 'PRO',
          firstServiceFeeWaived: false,
          petCount: 1,
          prices: [
            {
              serviceCode: 'HOME_VISIT',
              caregiverPriceCents: null,
              range: { minCents: 1100, suggestedCents: 1300, maxCents: 1500 },
              unitPriceCents: 1300,
            },
          ],
        },
        slots: [{ unitPriceCents: 1300, subtotalCents: 1300 }],
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

      // Nights: 3000 × 1.5 = 4500. The visit: 1300 × 1.5 = 1950.
      expect(body.slots).toMatchObject([
        { serviceCode: 'OVERNIGHT_STAY', unitPriceCents: 3000, subtotalCents: 4500 },
        { serviceCode: 'HOME_VISIT', unitPriceCents: 1300, subtotalCents: 1950 },
        { serviceCode: 'OVERNIGHT_STAY', unitPriceCents: 3000, subtotalCents: 4500 },
      ]);
      // 10 950 × 15% = 1642.5, which rounds half up to 1643.
      expect(await bookingRow(body.id)).toMatchObject({
        subtotalCents: 10_950,
        ownerServiceFeeCents: 1643,
        totalCents: 12_593,
        caregiverCommissionCents: 0,
        caregiverPayoutCents: 10_950,
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
        level: 'PRO',
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

  describe('POST /v1/bookings/quote and the first service without a fee (RN-PRE-09, RN-PRE-10)', () => {
    it('quotes the same total as the booking it precedes', async () => {
      for (const newcomer of [false, true]) {
        const { book, quote } = await owner('santa-tecla', { newcomer });
        const body = { visits: [at(day(20), newcomer ? '10:00' : '12:00')] };
        const before = await db.prisma.booking.count();

        const quoted = await quote(body).expect(200);
        expect(await db.prisma.booking.count()).toBe(before);
        const booking = await book(body).expect(201);

        expect(quoted.body.totalCents).toBe(booking.body.price.totalCents);
        expect(quoted.body).toEqual(booking.body.price);
        expect(quoted.body).toEqual(
          newcomer
            ? {
                subtotalCents: 1300,
                serviceFeeBp: 0,
                serviceFeeCents: 0,
                totalCents: 1300,
                firstServiceFeeWaived: true,
                // What the fee would have been: 1300 × 15% = 195.
                waivedServiceFeeCents: 195,
              }
            : {
                subtotalCents: 1300,
                serviceFeeBp: 1500,
                serviceFeeCents: 195,
                totalCents: 1495,
                firstServiceFeeWaived: false,
                waivedServiceFeeCents: 0,
              },
        );
      }
    });

    it('validates the quote like a booking', async () => {
      const { book, quote } = await owner();
      await book({ visits: [at(day(21), '10:00')] }).expect(201);

      const taken = await quote({ visits: [at(day(21), '10:00')] }).expect(409);

      expect(taken.body.errorCode).toBe('SLOT_TAKEN');
    });

    it('still checks the pets, the schedule and the ⭐ of a Special pet', async () => {
      const { pet, quote } = await owner();
      const toby = await pet('Toby');
      const nala = await pet('Nala', [
        { task: 'MOBILITY_ASSISTANCE', ownerInstructions: 'Ayudarla a subir al sofá.' },
      ]);
      // Diego works in Santa Tecla on Saturdays from 9:00 to 17:00 and has no ⭐.
      const saturday = [0, 1, 2, 3, 4, 5, 6]
        .map(day)
        .find((date) => new Date(`${date}T12:00:00-06:00`).getUTCDay() === 6)!;
      const visits = [at(saturday, '10:00')];
      const withDiego = { caregiverId: caregivers.Diego, visits };

      await quote({ ...withDiego, petIds: [toby] }).expect(200);
      const special = await quote({ ...withDiego, petIds: [nala] });
      const prohibited = await quote({
        visits,
        petIds: [await pet('Rocky', [{ task: 'INJECTION' }])],
      });
      const tooMany = await quote({
        visits,
        petIds: [toby, nala, await pet('Max'), await pet('Luna')],
      });
      const soon = await quote({ visits: [new Date(Date.now() + 30 * 60_000).toISOString()] });

      expect([special.status, special.body.errorCode]).toEqual([409, 'CAREGIVER_UNAVAILABLE']);
      expect([prohibited.status, prohibited.body.errorCode]).toEqual([422, 'PET_NOT_BOOKABLE']);
      expect([tooMany.status, tooMany.body.errorCode]).toEqual([422, 'TOO_MANY_PETS']);
      expect([soon.status, soon.body.errorCode]).toEqual([422, 'TOO_SOON']);
    });

    it('does not take the first service without a fee: only the booking does (RN-PRE-09)', async () => {
      const { book, quote, as } = await owner('santa-tecla', { newcomer: true });
      const waiverEndsAt = async () => (await as.get('/v1/users/me').expect(200)).body;

      const first = await quote({ visits: [at(day(35), '10:00')] }).expect(200);
      const second = await quote({ visits: [at(day(35), '10:00')] }).expect(200);
      const before = await waiverEndsAt();

      expect(first.body).toMatchObject({ firstServiceFeeWaived: true, waivedServiceFeeCents: 195 });
      expect(second.body).toEqual(first.body);
      expect(before.firstServiceFeeWaiverEndsAt).not.toBeNull();
      expect(await db.prisma.booking.count({ where: { ownerId: before.id } })).toBe(0);

      await book({ visits: [at(day(35), '10:00')] }).expect(201);
      const third = await quote({ visits: [at(day(36), '10:00')] }).expect(200);

      expect(third.body).toMatchObject({
        firstServiceFeeWaived: false,
        serviceFeeCents: 195,
        waivedServiceFeeCents: 0,
      });
      expect((await waiverEndsAt()).firstServiceFeeWaiverEndsAt).toBeNull();
    });

    it('saves the waiver in the booking and keeps the zero fee in its snapshot (RN-PRE-07)', async () => {
      const { book } = await owner('santa-tecla', { newcomer: true });

      const { body } = await book({ visits: [at(day(22), '10:00')] }).expect(201);

      expect(await bookingRow(body.id)).toMatchObject({
        firstServiceFeeWaived: true,
        caregiverLevel: 'PRO',
        ownerServiceFeeBp: 0,
        ownerServiceFeeCents: 0,
        totalCents: 1300,
        caregiverPayoutCents: 1300,
        pricingSnapshot: {
          firstServiceFeeWaived: true,
          waivedServiceFeeCents: 195,
          rates: { ownerServiceFeeBp: 0 },
        },
      });
    });

    it('does not repeat with two active bookings, and comes back if the first expires', async () => {
      const { user, as, book } = await owner('santa-tecla', { newcomer: true });
      const me = async () =>
        (await as.get('/v1/users/me').expect(200)).body.firstServiceFeeWaiverEndsAt;
      const first = (await book({ visits: [at(day(23), '10:00')] }).expect(201)).body;
      const meWhileActive = await me();
      const second = (await book({ visits: [at(day(23), '12:00')] }).expect(201)).body;

      await api.app().get(BookingStateMachine).transition(first.id, {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.EXPIRED,
        changedById: null,
      });
      const meAfterExpiring = await me();
      const third = (await book({ visits: [at(day(23), '14:00')] }).expect(201)).body;
      const fourth = (await book({ visits: [at(day(23), '16:00')] }).expect(201)).body;

      expect(
        [first, second, third, fourth].map(({ price }) => price.firstServiceFeeWaived),
      ).toEqual([true, false, true, false]);
      expect(second.price.serviceFeeCents).toBe(195);
      expect(meWhileActive).toBeNull();
      expect(meAfterExpiring).toBe(
        new Date(
          (await db.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).createdAt.getTime() +
            15 * DAY_MS,
        ).toISOString(),
      );
    });

    it('gives it to only one of two requests made at the same time', async () => {
      const { book } = await owner('santa-tecla', { newcomer: true });

      const responses = await Promise.all([
        book({ visits: [at(day(24), '10:00')] }),
        book({ visits: [at(day(24), '12:00')] }),
      ]);

      expect(responses.map(({ status }) => status)).toEqual([201, 201]);
      expect(
        responses.filter(({ body }) => body.price.firstServiceFeeWaived === true),
      ).toHaveLength(1);
    });

    it('applies within 15 days of registering, and not after (RN-PRE-09)', async () => {
      const inside = await owner('santa-tecla', { newcomer: true });
      await registeredDaysAgo(inside.user.id, 14);
      const outside = await owner('santa-tecla', { newcomer: true });
      await registeredDaysAgo(outside.user.id, 16);

      const a = await inside.book({ visits: [at(day(25), '10:00')] }).expect(201);
      const b = await outside.book({ visits: [at(day(25), '12:00')] }).expect(201);

      expect([a, b].map(({ body }) => body.price.firstServiceFeeWaived)).toEqual([true, false]);
      expect(
        (await outside.as.get('/v1/users/me').expect(200)).body.firstServiceFeeWaiverEndsAt,
      ).toBeNull();
    });

    it('does not apply to an owner who already paid a booking', async () => {
      const { book } = await owner('santa-tecla', { newcomer: true });
      const paid = (await book({ visits: [at(day(26), '10:00')] }).expect(201)).body;
      await db.prisma.payment.create({
        data: {
          bookingId: paid.id,
          provider: 'WOMPI',
          status: 'APPROVED',
          amountCents: paid.price.totalCents,
          approvedAt: new Date(),
        },
      });
      await api.app().get(BookingStateMachine).transition(paid.id, {
        from: BookingStatus.PENDING_PAYMENT,
        to: BookingStatus.CONFIRMED,
        changedById: null,
      });

      const next = await book({ visits: [at(day(26), '12:00')] }).expect(201);

      expect(next.body.price).toMatchObject({ firstServiceFeeWaived: false, serviceFeeCents: 195 });
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
