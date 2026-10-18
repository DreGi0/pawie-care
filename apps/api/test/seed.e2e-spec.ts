import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPassword } from '../src/auth/passwords.js';
import { formatDateOnly } from '../src/common/time/calendar.js';
import { CareLevel, CertificationStatus, ServiceCode } from '../src/generated/prisma/client.js';
import { careLevelOn } from '../src/pets/care-level.js';
import { seedDatabase, type SeedSummary } from '../src/seed/seed-database.js';
import { SETTING_KEYS } from '../src/settings/settings.registry.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { storageForTests } from './storage.js';

const NOW = new Date('2026-10-17T18:00:00Z');
const TODAY = new Date('2026-10-17');
const DEMO_OWNER_PASSWORD = 'contraseña-de-la-demo';
const DEMO_CAREGIVER_PHONE = '+503 2200 0000';
const PHOTO = Buffer.from('una imagen genérica');

/** A media directory with a photo for Valeria and one for Toby, as seed-media/README.md says. */
async function mediaDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'pawie-seed-media-'));
  await mkdir(join(directory, 'caregivers'));
  await mkdir(join(directory, 'pets'));
  await writeFile(join(directory, 'caregivers', 'valeria.martinez.png'), PHOTO);
  await writeFile(join(directory, 'pets', 'Toby.JPG'), PHOTO);
  return directory;
}

describe('seed', () => {
  let db: TestDatabase;
  let settings: SettingsService;
  let firstRun: Snapshot;
  let secondRun: SeedSummary;
  const storage = storageForTests();

  beforeAll(async () => {
    db = await createTestDatabase();
    settings = new SettingsService(db.prisma);

    const options = {
      now: NOW,
      demoOwnerPassword: DEMO_OWNER_PASSWORD,
      demoCaregiverPhone: DEMO_CAREGIVER_PHONE,
      media: { storage, directory: await mediaDirectory() },
    };

    await seedDatabase(db.prisma, settings, options);
    firstRun = await snapshot();
    // A change made with settings:set between two runs must survive the second one.
    await settings.set('pricing.ownerServiceFeeBp', 1100, { changedBy: 'test' });
    secondRun = await seedDatabase(db.prisma, settings, options);
  });

  afterAll(async () => {
    await db.close();
  });

  type Snapshot = Awaited<ReturnType<typeof snapshot>>;

  function snapshot() {
    return db.prisma.$transaction([
      db.prisma.district.findMany({ orderBy: { slug: 'asc' } }),
      db.prisma.species.findMany({ orderBy: { code: 'asc' } }),
      db.prisma.service.findMany({ orderBy: { code: 'asc' } }),
      db.prisma.user.findMany({
        orderBy: { email: 'asc' },
        select: { id: true, email: true, passwordHash: true },
      }),
      // Without timestamps: updatedAt moves even when nothing changes.
      db.prisma.address.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          userId: true,
          label: true,
          street: true,
          details: true,
          districtId: true,
        },
      }),
      db.prisma.pet.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, photoFileId: true },
      }),
      db.prisma.petCareNeed.count(),
      db.prisma.file.findMany({
        orderBy: { storageKey: 'asc' },
        select: { id: true, storageKey: true },
      }),
      db.prisma.caregiverServicePrice.count(),
      db.prisma.caregiverAvailability.count(),
      db.prisma.caregiverCertification.count(),
      db.prisma.setting.count(),
    ]);
  }

  function caregivers() {
    return db.prisma.caregiverProfile.findMany({
      include: {
        user: true,
        districts: true,
        servicePrices: { include: { service: true } },
        availability: true,
        certifications: { include: { certificationType: true } },
      },
    });
  }

  it('can run again without duplicating or replacing anything', async () => {
    expect(await snapshot()).toEqual(firstRun);
  });

  it('creates the demo owner, who signs in with DEMO_OWNER_PASSWORD', async () => {
    const owner = await db.prisma.user.findUniqueOrThrow({
      where: { email: 'demo@example.com' },
      include: { addresses: { include: { district: true } } },
    });

    expect(owner.roles).toEqual(['OWNER']);
    expect(await verifyPassword(DEMO_OWNER_PASSWORD, owner.passwordHash ?? '')).toBe(true);
    expect(owner.addresses).toMatchObject([{ label: 'Casa', district: { slug: 'san-salvador' } }]);
  });

  it('gives the demo caregivers the phone of DEMO_CAREGIVER_PHONE (RN-CTA-04)', async () => {
    const phones = (await caregivers()).map(({ user }) => user.phone);

    expect(secondRun.caregiverPhone).toBe(DEMO_CAREGIVER_PHONE);
    expect(new Set(phones)).toEqual(new Set([DEMO_CAREGIVER_PHONE]));
  });

  it('skips the demo owner and the caregivers phone when their variables are not set', async () => {
    const empty = await createTestDatabase();
    try {
      const summary = await seedDatabase(empty.prisma, new SettingsService(empty.prisma), {
        now: NOW,
      });

      expect(summary).toMatchObject({ demoOwner: null, caregiverPhone: null });
      expect(await empty.prisma.user.count({ where: { email: 'demo@example.com' } })).toBe(0);
      expect(await empty.prisma.user.count({ where: { phone: { not: null } } })).toBe(0);
    } finally {
      await empty.close();
    }
  });

  it('uploads the photos it finds in the media directory, and only those', async () => {
    const withPhoto = await db.prisma.caregiverProfile.findMany({
      where: { photoFileId: { not: null } },
      include: { user: true, photoFile: true },
    });
    const toby = await db.prisma.pet.findFirstOrThrow({
      where: { name: 'Toby' },
      include: { photoFile: true },
    });

    expect(secondRun.photos).toBe(2);
    expect(withPhoto.map(({ user }) => user.firstName)).toEqual(['Valeria']);
    expect(withPhoto[0].photoFile).toMatchObject({
      purpose: 'CAREGIVER_PHOTO',
      contentType: 'image/png',
      sizeBytes: PHOTO.length,
      uploadedAt: expect.any(Date),
    });
    expect(toby.photoFile).toMatchObject({ purpose: 'PET_PHOTO', contentType: 'image/jpeg' });
    expect(await storage.head(withPhoto[0].photoFile?.storageKey ?? '')).toEqual({
      sizeBytes: PHOTO.length,
      contentType: 'image/png',
    });
  });

  it('gives the demo owner a standard, a special and a pet that cannot be booked', async () => {
    const pets = await db.prisma.pet.findMany({
      where: { owner: { email: 'demo@example.com' } },
      include: { careNeeds: true, species: true },
      orderBy: { name: 'asc' },
    });

    expect(
      pets.map((pet) => {
        const { careLevel, prohibitedTasks } = careLevelOn(pet.careNeeds, TODAY, TODAY);
        return [pet.name, pet.species.code, careLevel, prohibitedTasks];
      }),
    ).toEqual([
      ['Nala', 'CAT', 'SPECIAL', []],
      ['Rocky', 'DOG', 'STANDARD', ['INJECTION']],
      ['Toby', 'DOG', 'STANDARD', []],
    ]);
    expect(formatDateOnly(pets[0].careNeeds[0].startsOn)).toBe('2026-04-17');
  });

  it('keeps the settings that were changed after the first run', async () => {
    expect(await settings.get('pricing.ownerServiceFeeBp')).toBe(1100);
  });

  it('loads the 14 districts of the AMSS', async () => {
    const districts = await db.prisma.district.findMany({ orderBy: { name: 'asc' } });

    expect(districts.map(({ name }) => name)).toEqual([
      'Antiguo Cuscatlán',
      'Apopa',
      'Ayutuxtepeque',
      'Ciudad Delgado',
      'Cuscatancingo',
      'Ilopango',
      'Mejicanos',
      'Nejapa',
      'San Marcos',
      'San Martín',
      'San Salvador',
      'Santa Tecla',
      'Soyapango',
      'Tonacatepeque',
    ]);
  });

  it('loads dogs, cats and the two services', async () => {
    const [species, services] = await Promise.all([
      db.prisma.species.findMany({ orderBy: { code: 'asc' } }),
      db.prisma.service.findMany({ orderBy: { code: 'asc' } }),
    ]);

    expect(species.map(({ code, name }) => [code, name])).toEqual([
      ['CAT', 'Gato'],
      ['DOG', 'Perro'],
    ]);
    expect(services.map(({ code }) => code)).toEqual([
      ServiceCode.HOME_VISIT,
      ServiceCode.OVERNIGHT_STAY,
    ]);
  });

  it('loads every setting of §15 with a valid value', async () => {
    for (const key of SETTING_KEYS) {
      await expect(settings.get(key), key).resolves.toBeDefined();
    }
    expect(await db.prisma.setting.count()).toBe(SETTING_KEYS.length);
  });

  it('loads about ten approved caregivers with instant booking who cannot sign in', async () => {
    const all = await caregivers();

    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const { status, isActive, instantBooking, user } of all) {
      expect({ status, isActive, instantBooking }).toEqual({
        status: 'APPROVED',
        isActive: true,
        instantBooking: true,
      });
      expect(user.roles).toEqual(['CAREGIVER']);
      expect(user.passwordHash).toBeNull();
    }
  });

  it('mixes caregivers with the ⭐, vet students, both and neither', async () => {
    const all = await caregivers();
    const profiles = new Set(
      all.map(({ certifications, vetStudentUntil }) => {
        const star = certifications.some(({ status }) => status === CertificationStatus.ACTIVE);
        const student = vetStudentUntil !== null && vetStudentUntil >= TODAY;
        return `${star ? '⭐' : '-'} ${student ? 'student' : '-'}`;
      }),
    );

    expect([...profiles].toSorted()).toEqual(['- -', '- student', '⭐ -', '⭐ student']);
  });

  it('includes caregivers who do no overnight stays', async () => {
    const all = await caregivers();
    const withoutOvernights = all.filter(
      ({ servicePrices }) =>
        !servicePrices.some(({ service }) => service.code === ServiceCode.OVERNIGHT_STAY),
    );

    expect(withoutOvernights.length).toBeGreaterThan(0);
  });

  it('gives every caregiver districts, prices within range, a schedule and ratings', async () => {
    const ranges = await settings.get('pricing.priceRanges');

    for (const caregiver of await caregivers()) {
      const name = caregiver.user.firstName;
      const hasStar = caregiver.certifications.length > 0;

      expect(caregiver.districts.length, name).toBeGreaterThan(0);
      expect(caregiver.availability.length, name).toBeGreaterThan(0);
      expect(caregiver.ratingSum, name).toBeLessThanOrEqual(caregiver.ratingCount * 5);
      expect(caregiver.completedBookingCount, name).toBeGreaterThanOrEqual(caregiver.ratingCount);

      const homeVisit = caregiver.servicePrices.filter(
        ({ service }) => service.code === ServiceCode.HOME_VISIT,
      );
      expect(homeVisit.length, name).toBeGreaterThan(0);

      for (const { service, careLevel, priceCents } of caregiver.servicePrices) {
        // RN-RES-01: only caregivers with the ⭐ offer the Special level.
        expect(careLevel === CareLevel.STANDARD || hasStar, name).toBe(true);
        if (priceCents !== null) {
          const { minCents, maxCents } = ranges[service.code][careLevel];
          expect(priceCents, `${name} ${service.code} ${careLevel}`).toBeGreaterThanOrEqual(
            minCents,
          );
          expect(priceCents, `${name} ${service.code} ${careLevel}`).toBeLessThanOrEqual(maxCents);
        }
      }
    }
  });

  it('gives overnight caregivers a window that covers the overnight hours', async () => {
    const { startMinute, endMinute } = await settings.get('services.overnightHours');

    for (const caregiver of await caregivers()) {
      const doesOvernights = caregiver.servicePrices.some(
        ({ service }) => service.code === ServiceCode.OVERNIGHT_STAY,
      );
      const coversAnOvernight = caregiver.availability.some(
        (window) => window.startMinute <= startMinute && window.endMinute >= endMinute + 24 * 60,
      );

      expect(coversAnOvernight, caregiver.user.firstName).toBe(doesOvernights);
    }
  });

  it('keeps every ⭐ valid today, for the configured months (RN-CUI-09)', async () => {
    const validityMonths = await settings.get('certifications.specialCareValidityMonths');

    for (const { certifications, user } of await caregivers()) {
      for (const { certificationType, obtainedOn, validUntil } of certifications) {
        expect(certificationType.code).toBe('SPECIAL_CARE');
        expect(obtainedOn <= TODAY && validUntil >= TODAY, user.firstName).toBe(true);
        const months =
          (validUntil.getUTCFullYear() - obtainedOn.getUTCFullYear()) * 12 +
          validUntil.getUTCMonth() -
          obtainedOn.getUTCMonth();
        expect(months, user.firstName).toBeLessThanOrEqual(validityMonths);
      }
    }
  });
});
