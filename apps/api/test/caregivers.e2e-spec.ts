import {
  addDays,
  dateInElSalvador,
  formatDateOnly,
  isoWeekday,
} from '../src/common/time/calendar.js';
import { BookingStatus, type CareTask } from '../src/generated/prisma/client.js';
import { seedDatabase } from '../src/seed/seed-database.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { changeStatus, createBooking, createCatalog, createUser } from './factories.js';
import { useApi } from './use-api.js';

/** The next date, at least three days ahead, that falls on this ISO weekday. */
function next(weekday: number): string {
  let day = addDays(dateInElSalvador(new Date()), 3);
  while (isoWeekday(day) !== weekday) {
    day = addDays(day, 1);
  }
  return formatDateOnly(day);
}

const WEDNESDAY = next(3);
const FRIDAY = next(5);
const SATURDAY = formatDateOnly(addDays(new Date(FRIDAY), 1));
const at = (date: string, time: string) => `${date}T${time}:00-06:00`;

describe('caregivers', () => {
  let db: TestDatabase;
  let settings: SettingsService;
  let token: string;
  let ownerId: string;
  const districts: Record<string, string> = {};
  const caregivers: Record<string, string> = {};

  beforeAll(async () => {
    db = await createTestDatabase();
    settings = new SettingsService(db.prisma);
    await seedDatabase(db.prisma, settings);
    for (const { slug, id } of await db.prisma.district.findMany()) {
      districts[slug] = id;
    }
    for (const { id, firstName } of await db.prisma.user.findMany({
      where: { roles: { has: 'CAREGIVER' } },
    })) {
      caregivers[firstName] = id;
    }
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db);

  beforeAll(async () => {
    const owner = await createUser(db.prisma);
    ownerId = owner.id;
    token = await api.tokenFor(owner);
  });

  async function pet(needs: { task: CareTask; ownerInstructions?: string }[] = []) {
    const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
    const created = await db.prisma.pet.create({
      data: {
        ownerId,
        speciesId: dog.id,
        name: needs.length > 0 ? 'Rocky' : 'Toby',
        birthDate: new Date('2018-01-01'),
        sex: 'MALE',
        careNeeds: {
          create: needs.map((need) => ({ ...need, startsOn: new Date('2026-01-01') })),
        },
      },
    });
    return created.id;
  }

  const search = (body: Record<string, unknown>) =>
    api.http().post('/v1/caregivers/search').auth(token, { type: 'bearer' }).send(body);

  const names = (results: { displayName: string }[]) =>
    results.map(({ displayName }) => displayName);

  describe('POST /v1/caregivers/search (RN-RES-01)', () => {
    it('finds who covers the district and is free, best rated first', async () => {
      const { body } = await search({
        petIds: [await pet()],
        serviceCode: 'HOME_VISIT',
        visits: [at(WEDNESDAY, '15:00')],
        districtId: districts['santa-tecla'],
      }).expect(200);

      expect(body.careLevel).toBe('STANDARD');
      expect(body.slots).toEqual([
        {
          serviceCode: 'HOME_VISIT',
          startsAt: new Date(at(WEDNESDAY, '15:00')).toISOString(),
          endsAt: new Date(at(WEDNESDAY, '16:00')).toISOString(),
        },
      ]);
      // Valeria and María José tie at 4.8; Valeria has more services.
      expect(names(body.results)).toEqual(['Valeria M.', 'María José R.', 'Carlos H.', 'Diego C.']);
      expect(body.results[0]).toMatchObject({
        hasSpecialCareCertification: true,
        isVetStudent: true,
        rating: 4.8,
        ratingCount: 46,
        instantBooking: true,
        prices: [{ serviceCode: 'HOME_VISIT', careLevel: 'STANDARD', priceCents: 1300 }],
      });
    });

    it('leaves out who has no window at that time', async () => {
      const { body } = await search({
        petIds: [await pet()],
        serviceCode: 'HOME_VISIT',
        visits: [at(WEDNESDAY, '10:00')],
        districtId: districts['santa-tecla'],
      }).expect(200);

      // Valeria starts at 14:00 and Diego at 12:00 on Wednesdays.
      expect(names(body.results)).toEqual(['María José R.', 'Carlos H.']);
    });

    it('only shows caregivers with the ⭐ when a pet is Special', async () => {
      const special = await pet([
        { task: 'MOBILITY_ASSISTANCE', ownerInstructions: 'Ayudarlo a subir las gradas.' },
      ]);

      const { body } = await search({
        petIds: [special],
        serviceCode: 'HOME_VISIT',
        visits: [at(WEDNESDAY, '15:00')],
        districtId: districts['santa-tecla'],
      }).expect(200);

      expect(body.careLevel).toBe('SPECIAL');
      expect(
        body.results.map(({ displayName, prices }: { displayName: string; prices: unknown }) => [
          displayName,
          prices,
        ]),
      ).toEqual([
        ['Valeria M.', [{ serviceCode: 'HOME_VISIT', careLevel: 'SPECIAL', priceCents: 1800 }]],
        // Carlos didn't set a Special visit price, so the suggested one applies.
        ['Carlos H.', [{ serviceCode: 'HOME_VISIT', careLevel: 'SPECIAL', priceCents: 1700 }]],
      ]);
    });

    it('finds overnight caregivers, and takes away whoever is booked then', async () => {
      const toby = await pet();
      const stay = {
        petIds: [toby],
        serviceCode: 'OVERNIGHT_STAY',
        nights: [FRIDAY, SATURDAY],
        visits: [at(SATURDAY, '13:00')],
        districtId: districts['san-salvador'],
      };

      const before = await search(stay).expect(200);
      const booking = await createBooking(db.prisma, await createCatalog(db.prisma), {
        caregiverId: caregivers.Ricardo,
        slots: [{ startsAt: new Date(at(FRIDAY, '22:00')), endsAt: new Date(at(FRIDAY, '23:00')) }],
      });
      const whileBooked = await search(stay).expect(200);
      await changeStatus(db.prisma, booking.id, BookingStatus.CANCELLED_BY_OWNER);
      const afterCancelling = await search(stay).expect(200);

      // Gabriela doesn't do overnights. Fernando has 4.9; Ricardo, Valeria and Andrea tie
      // at 4.8 and go by completed services.
      expect(names(before.body.results)).toEqual([
        'Fernando M.',
        'Ricardo P.',
        'Valeria M.',
        'Andrea L.',
        'Carlos H.',
      ]);
      const valeria = before.body.results.find(
        ({ displayName }: { displayName: string }) => displayName === 'Valeria M.',
      );
      expect(valeria.prices).toEqual([
        { serviceCode: 'OVERNIGHT_STAY', careLevel: 'STANDARD', priceCents: 2800 },
        { serviceCode: 'HOME_VISIT', careLevel: 'STANDARD', priceCents: 1300 },
      ]);
      expect(names(whileBooked.body.results)).not.toContain('Ricardo P.');
      expect(names(afterCancelling.body.results)).toContain('Ricardo P.');
    });

    it('explains why a pet with a prohibited need cannot be booked (RN-MAS-09)', async () => {
      const response = await search({
        petIds: [await pet(), await pet([{ task: 'INJECTION' }])],
        serviceCode: 'HOME_VISIT',
        visits: [at(WEDNESDAY, '15:00')],
        districtId: districts['santa-tecla'],
      }).expect(422);

      expect(response.body).toMatchObject({
        errorCode: 'PET_NOT_BOOKABLE',
        message:
          'Ningún cuidador de Pawie puede ponerle inyecciones, así que Rocky no se puede reservar en esas fechas.',
        details: { pets: [{ name: 'Rocky', tasks: ['INJECTION'] }] },
      });
    });

    it('takes up to the maximum of pets (RN-RES-03)', async () => {
      const petIds = await Promise.all([pet(), pet(), pet(), pet()]);

      const response = await search({
        petIds,
        serviceCode: 'HOME_VISIT',
        visits: [at(WEDNESDAY, '15:00')],
        districtId: districts['santa-tecla'],
      }).expect(422);

      expect(response.body).toMatchObject({
        errorCode: 'TOO_MANY_PETS',
        message: 'Puedes reservar hasta 3 mascotas a la vez.',
      });
    });

    it("rejects another owner's pet, a slot too soon and an unknown district", async () => {
      const stranger = await createUser(db.prisma);
      const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
      const theirs = await db.prisma.pet.create({
        data: {
          ownerId: stranger.id,
          speciesId: dog.id,
          name: 'Ajena',
          birthDate: new Date('2020-01-01'),
          sex: 'FEMALE',
        },
      });
      const visit = { serviceCode: 'HOME_VISIT', visits: [at(WEDNESDAY, '15:00')] };

      const foreign = await search({
        ...visit,
        petIds: [theirs.id],
        districtId: districts['santa-tecla'],
      }).expect(404);
      const soon = await search({
        petIds: [await pet()],
        serviceCode: 'HOME_VISIT',
        visits: [new Date(Date.now() + 30 * 60_000).toISOString()],
        districtId: districts['santa-tecla'],
      }).expect(422);
      const district = await search({
        ...visit,
        petIds: [await pet()],
        districtId: '01a14c39-0000-7000-8000-000000000000',
      }).expect(422);

      expect(foreign.body.errorCode).toBe('PET_NOT_FOUND');
      expect(soon.body.errorCode).toBe('TOO_SOON');
      expect(district.body.errorCode).toBe('UNKNOWN_DISTRICT');
    });
  });

  describe('GET /v1/caregivers/:id (RN-RES-02)', () => {
    const profile = (id: string) =>
      api.http().get(`/v1/caregivers/${id}`).auth(token, { type: 'bearer' });

    it('shows the badges, the rating, the districts and the prices', async () => {
      const { body } = await profile(caregivers.Valeria).expect(200);

      expect(body).toMatchObject({
        displayName: 'Valeria M.',
        hasSpecialCareCertification: true,
        isVetStudent: true,
        rating: 4.8,
        completedBookingCount: 52,
        instantBooking: true,
        bio: expect.stringContaining('Medicina Veterinaria'),
      });
      expect(body.districts.map(({ name }: { name: string }) => name)).toEqual([
        'Antiguo Cuscatlán',
        'San Salvador',
        'Santa Tecla',
      ]);
      expect(body.prices).toEqual([
        { serviceCode: 'HOME_VISIT', careLevel: 'SPECIAL', priceCents: 1800 },
        { serviceCode: 'HOME_VISIT', careLevel: 'STANDARD', priceCents: 1300 },
        { serviceCode: 'OVERNIGHT_STAY', careLevel: 'SPECIAL', priceCents: 4000 },
        { serviceCode: 'OVERNIGHT_STAY', careLevel: 'STANDARD', priceCents: 2800 },
      ]);
    });

    it('has no rating yet for a new caregiver', async () => {
      const { body } = await profile(caregivers.Sofía).expect(200);

      expect(body).toMatchObject({
        rating: null,
        ratingCount: 0,
        hasSpecialCareCertification: false,
      });
    });

    it('hides caregivers who are not approved and active', async () => {
      await db.prisma.caregiverProfile.update({
        where: { userId: caregivers.José },
        data: { isActive: false },
      });

      const response = await profile(caregivers.José).expect(404);

      expect(response.body.errorCode).toBe('CAREGIVER_NOT_FOUND');
    });

    it('keeps prices within the current range, even after it changes', async () => {
      const ranges = await settings.get('pricing.priceRanges');
      ranges.HOME_VISIT.STANDARD = { minCents: 1100, suggestedCents: 1200, maxCents: 1250 };
      await settings.set('pricing.priceRanges', ranges, { changedBy: 'test' });

      // Valeria charges 1300 and Fernando 1000 for a standard visit.
      const valeria = await profile(caregivers.Valeria).expect(200);
      const fernando = await profile(caregivers.Fernando).expect(200);

      const visit = ({ serviceCode, careLevel }: { serviceCode: string; careLevel: string }) =>
        serviceCode === 'HOME_VISIT' && careLevel === 'STANDARD';
      expect(valeria.body.prices.find(visit).priceCents).toBe(1250);
      expect(fernando.body.prices.find(visit).priceCents).toBe(1100);
    });
  });
});
