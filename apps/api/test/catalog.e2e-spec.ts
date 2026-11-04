import { seedDatabase } from '../src/seed/seed-database.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { createUser } from './factories.js';
import { useApi } from './use-api.js';

describe('GET /v1/catalog', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.prisma, new SettingsService(db.prisma));
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db);

  it('lists districts, species, services and the limits for a booking', async () => {
    const token = await api.tokenFor(await createUser(db.prisma));

    const { body } = await api
      .http()
      .get('/v1/catalog')
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(body.districts).toHaveLength(14);
    expect(body.districts.slice(0, 3).map(({ name }: { name: string }) => name)).toEqual([
      'Antiguo Cuscatlán',
      'Apopa',
      'Ayutuxtepeque',
    ]);
    expect(body.districts.at(-1)).toMatchObject({ slug: 'tonacatepeque', name: 'Tonacatepeque' });
    expect(body.species.map(({ code }: { code: string }) => code)).toEqual(['CAT', 'DOG']);
    expect(body.services.map(({ code }: { code: string }) => code)).toEqual([
      'HOME_VISIT',
      'OVERNIGHT_STAY',
    ]);
    expect(body.bookingRules).toEqual({
      maxPetsPerBooking: 3,
      minLeadTimeMinutes: 120,
      homeVisitMinutes: 60,
      overnightStartMinute: 1140,
      overnightEndMinute: 480,
    });
  });

  it('lists the care tasks with what each one asks for (RN-MAS-06, RN-MAS-08, RN-MAS-09)', async () => {
    const token = await api.tokenFor(await createUser(db.prisma));

    const { body } = await api
      .http()
      .get('/v1/catalog')
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(body.careTasks).toHaveLength(15);
    expect(body.careTasks[0]).toEqual({
      code: 'MEDICATION',
      name: 'Medicación',
      group: 'CLINICAL',
      canBeOpenEnded: false,
    });
    expect(body.careTasks).toContainEqual({
      code: 'MOBILITY_ASSISTANCE',
      name: 'Ayuda para moverse',
      group: 'ASSISTANCE',
      canBeOpenEnded: true,
    });
    expect(body.careTasks.at(-1)).toMatchObject({ group: 'PROHIBITED', canBeOpenEnded: true });
  });

  it('needs a signed-in user, like the rest of the app', async () => {
    await api.http().get('/v1/catalog').expect(401);
  });
});
