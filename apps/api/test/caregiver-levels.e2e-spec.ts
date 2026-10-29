import { addDays, dateInElSalvador } from '../src/common/time/calendar.js';
import { recalculateAllLevels, recalculateLevel } from '../src/caregivers/recalculate-level.js';
import { CaregiverLevel } from '../src/generated/prisma/client.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { createCaregiver } from './factories.js';

const { NEW, TRUSTED, PRO } = CaregiverLevel;

describe('caregiver levels (RN-NIV-04)', () => {
  let db: TestDatabase;
  let settings: SettingsService;

  beforeAll(async () => {
    db = await createTestDatabase();
    settings = new SettingsService(db.prisma);
    await settings.createMissing({ changedBy: 'test' });
  });

  afterAll(async () => {
    await db.close();
  });

  const levelOf = async (caregiverId: string) =>
    (await db.prisma.caregiverProfile.findUniqueOrThrow({ where: { userId: caregiverId } })).level;

  async function certify(caregiverId: string, code: string, validUntil: Date) {
    const type = await db.prisma.certificationType.upsert({
      where: { code },
      create: { code, name: code },
      update: {},
    });
    return db.prisma.caregiverCertification.create({
      data: {
        caregiverId,
        certificationTypeId: type.id,
        obtainedOn: addDays(validUntil, -30),
        validUntil,
      },
    });
  }

  it('moves up in the transaction that changes the ratings, and down with it', async () => {
    const { userId } = await createCaregiver(db.prisma);
    const requirements = await settings.get('levels.requirements');
    expect(await levelOf(userId)).toBe(NEW);

    const level = await db.prisma.$transaction(async (tx) => {
      await tx.caregiverProfile.update({
        where: { userId },
        data: { ratingCount: 4, ratingSum: 18 },
      });
      return recalculateLevel(tx, userId, requirements);
    });
    expect(level).toBe(TRUSTED);
    expect(await levelOf(userId)).toBe(TRUSTED);

    // A 1-star review brings the average to 3.8.
    await db.prisma.$transaction(async (tx) => {
      await tx.caregiverProfile.update({
        where: { userId },
        data: { ratingCount: 5, ratingSum: 19 },
      });
      await recalculateLevel(tx, userId, requirements);
    });
    expect(await levelOf(userId)).toBe(NEW);
  });

  it('leaves the level alone when the transaction that changed the data is rolled back', async () => {
    const { userId } = await createCaregiver(db.prisma);
    const requirements = await settings.get('levels.requirements');

    await expect(
      db.prisma.$transaction(async (tx) => {
        await tx.caregiverProfile.update({
          where: { userId },
          data: { ratingCount: 4, ratingSum: 18 },
        });
        await recalculateLevel(tx, userId, requirements);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(await levelOf(userId)).toBe(NEW);
  });

  it('counts only the certifications that are valid (RN-CUI-09, RN-CUI-10)', async () => {
    const { userId } = await createCaregiver(db.prisma);
    const requirements = await settings.get('levels.requirements');
    const now = new Date();
    const today = dateInElSalvador(now);
    await db.prisma.caregiverProfile.update({
      where: { userId },
      data: { ratingCount: 5, ratingSum: 24, completedBookingCount: 20 },
    });
    await certify(userId, 'SPECIAL_CARE', addDays(today, 10));
    await certify(userId, 'CATS', addDays(today, -1));
    const suspended = await certify(userId, 'LARGE_DOGS', addDays(today, 10));
    await db.prisma.caregiverCertification.update({
      where: { id: suspended.id },
      data: { suspendedUntil: addDays(now, 5) },
    });

    expect(
      await db.prisma.$transaction((tx) => recalculateLevel(tx, userId, requirements, now)),
    ).toBe(TRUSTED);

    await certify(userId, 'FIRST_AID', addDays(today, 10));
    expect(
      await db.prisma.$transaction((tx) => recalculateLevel(tx, userId, requirements, now)),
    ).toBe(PRO);
  });

  it('recalculates everyone, and says who changed (caregivers:recalculate-levels)', async () => {
    const { userId: expired } = await createCaregiver(db.prisma);
    const { userId: unchanged } = await createCaregiver(db.prisma);
    const today = dateInElSalvador(new Date());
    await db.prisma.caregiverProfile.update({
      where: { userId: expired },
      data: { level: PRO, ratingCount: 5, ratingSum: 24, completedBookingCount: 20 },
    });
    await certify(expired, 'SPECIAL_CARE', addDays(today, -1));

    const changes = await recalculateAllLevels(db.prisma, settings);

    expect(changes).toContainEqual({ caregiverId: expired, from: PRO, to: TRUSTED });
    expect(changes.map(({ caregiverId }) => caregiverId)).not.toContain(unchanged);
    expect(await levelOf(expired)).toBe(TRUSTED);
  });
});
