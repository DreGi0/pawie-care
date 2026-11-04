import { randomUUID } from 'node:crypto';
import { addDays } from '../src/common/time/calendar.js';
import { buildPilotReport } from '../src/metrics/pilot-report.js';
import type { DistrictSlug } from '../src/seed/catalog.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import {
  type Catalog,
  createBooking,
  createCaregiver,
  createCatalog,
  createUser,
  svTime,
} from './factories.js';

describe('pnpm metrics:report (RN-MET-01)', () => {
  let db: TestDatabase;
  let catalog: Catalog;

  const now = svTime('2026-11-04T12:00:00');

  beforeAll(async () => {
    db = await createTestDatabase();
    catalog = await createCatalog(db.prisma);
  });

  afterAll(async () => {
    await db.close();
  });

  /** The seed's accounts use example.com, and the report leaves them out. */
  const pilotEmail = () => `${randomUUID()}@pawie.test`;

  async function districtId(slug: DistrictSlug) {
    const { id } = await db.prisma.district.upsert({
      where: { slug },
      create: { slug, name: slug },
      update: {},
    });
    return id;
  }

  /** A caregiver with one window in the schedule and the given districts. */
  async function caregiver({
    email = pilotEmail(),
    districts = ['santa-tecla'],
    withSchedule = true,
    ...profile
  }: {
    email?: string;
    districts?: DistrictSlug[];
    withSchedule?: boolean;
    isPaused?: boolean;
    welcomeCoursePassedAt?: Date | null;
  } = {}) {
    const { userId } = await createCaregiver(db.prisma, { email, ...profile });
    for (const slug of districts) {
      await db.prisma.caregiverDistrict.create({
        data: { caregiverId: userId, districtId: await districtId(slug) },
      });
    }
    if (withSchedule) {
      await db.prisma.caregiverAvailability.create({
        data: { caregiverId: userId, weekday: 1, startMinute: 480, endMinute: 720 },
      });
    }
  }

  let nextSlotDay = 1;

  /** An owner who signs up `signedUpDaysAgo` days before now and pays on `paysOnDay`. */
  async function ownerWhoPays(caregiverId: string, signedUpDaysAgo: number, paysOnDay: number) {
    const signedUpAt = addDays(now, -signedUpDaysAgo);
    const owner = await createUser(db.prisma, undefined, {
      email: pilotEmail(),
      createdAt: signedUpAt,
    });
    const startsAt = addDays(svTime('2026-12-01T09:00:00'), nextSlotDay++);
    await createBooking(db.prisma, catalog, {
      caregiverId,
      ownerId: owner.id,
      confirmedAt: addDays(signedUpAt, paysOnDay),
      slots: [{ startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000) }],
    });
  }

  it('RN-MET-02 counts only verified active caregivers in the pilot, and RN-MET-04 counts payments up to day 15', async () => {
    // RN-MET-02: only the first one counts.
    await caregiver();
    await caregiver({ isPaused: true });
    await caregiver({ withSchedule: false });
    await caregiver({ welcomeCoursePassedAt: null });
    await caregiver({ districts: ['soyapango'] });
    await caregiver({ email: `${randomUUID()}@example.com` });

    // RN-MET-04: three owners who signed up 30 days ago. The one who signed up 5 days
    // ago hasn't had the whole 15 days, so they don't count.
    const { userId: bookedCaregiver } = await createCaregiver(db.prisma);
    await ownerWhoPays(bookedCaregiver, 30, 10);
    await ownerWhoPays(bookedCaregiver, 30, 15);
    await ownerWhoPays(bookedCaregiver, 30, 16);
    await ownerWhoPays(bookedCaregiver, 5, 1);

    const report = await buildPilotReport(db.prisma, {}, now);

    expect(report.criticalNumber).toBe(1);
    expect(report.value).toEqual({ numerator: 2, denominator: 3 });
  });
});
