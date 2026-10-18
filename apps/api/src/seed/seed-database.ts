import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { SPECIAL_CARE_CERTIFICATION } from '../caregivers/special-care.js';
import { addDays, addMonths, dateInElSalvador } from '../common/time/calendar.js';
import {
  CaregiverStatus,
  CareLevel,
  CertificationStatus,
  type PrismaClient,
  Role,
  type ServiceCode,
} from '../generated/prisma/client.js';
import type { SettingKey } from '../settings/settings.registry.js';
import type { SettingsService } from '../settings/settings.service.js';
import { DEMO_CAREGIVERS, type DemoCaregiver } from './caregivers.js';
import { DISTRICTS, SERVICES, SPECIES } from './catalog.js';
import { DEMO_OWNER } from './demo-owner.js';

export interface SeedOptions {
  /** Dates such as the ⭐ validity are relative to it. */
  now?: Date;
  /** DEMO_OWNER_PASSWORD. Without it, the demo owner isn't created. */
  demoOwnerPassword?: string;
}

export interface SeedSummary {
  districts: number;
  species: number;
  services: number;
  caregivers: number;
  /** Email of the demo owner, or null when there was no password for it. */
  demoOwner: string | null;
  /** Settings that didn't exist and got their initial value. */
  createdSettings: SettingKey[];
}

interface CatalogIds {
  districtIds: Map<string, string>;
  serviceIds: Map<ServiceCode, string>;
  specialCareTypeId: string;
}

/**
 * Loads what the demo needs: the catalog, every setting of §15, the demo caregivers
 * and the demo owner. It can run any number of times:
 * - the catalog and the accounts are upserted by their natural keys (slug, code,
 *   email), and each caregiver's districts, prices, schedule and ⭐ are replaced;
 * - settings that already exist keep their value, so it never undoes a settings:set.
 * Dates such as the ⭐ validity are relative to `now`, so the demo data stays current.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  settings: SettingsService,
  { now = new Date(), demoOwnerPassword }: SeedOptions = {},
): Promise<SeedSummary> {
  const catalog = await seedCatalog(prisma);
  const createdSettings = await settings.createMissing({
    changedBy: 'seed',
    reason: 'Valor inicial de la sección 15 de las reglas de negocio',
  });
  const validityMonths = await settings.get('certifications.specialCareValidityMonths');

  const today = dateInElSalvador(now);
  for (const caregiver of DEMO_CAREGIVERS) {
    await seedCaregiver(prisma, caregiver, catalog, { today, validityMonths });
  }
  if (demoOwnerPassword !== undefined) {
    await seedDemoOwner(prisma, demoOwnerPassword, catalog);
  }

  return {
    districts: DISTRICTS.length,
    species: SPECIES.length,
    services: SERVICES.length,
    caregivers: DEMO_CAREGIVERS.length,
    demoOwner: demoOwnerPassword === undefined ? null : DEMO_OWNER.email,
    createdSettings,
  };
}

async function seedDemoOwner(
  prisma: PrismaClient,
  password: string,
  { districtIds }: CatalogIds,
): Promise<void> {
  const { email, address, ...owner } = DEMO_OWNER;
  const existing = await prisma.user.findUnique({ where: { email } });
  // Keeps the hash while the password stays the same, so another run changes nothing.
  const passwordHash =
    existing?.passwordHash && (await verifyPassword(password, existing.passwordHash))
      ? existing.passwordHash
      : await hashPassword(password);
  const account = {
    firstName: owner.firstName,
    lastName: owner.lastName,
    birthDate: new Date(owner.birthDate),
    roles: [Role.OWNER],
    passwordHash,
  };
  const home = {
    label: address.label,
    street: address.street,
    details: address.details,
    districtId: required(districtIds.get(address.district), address.district),
  };

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      create: { email, ...account },
      update: account,
    });
    const current = await tx.address.findFirst({
      where: { userId: user.id, label: address.label },
    });
    await (current
      ? tx.address.update({ where: { id: current.id }, data: home })
      : tx.address.create({ data: { userId: user.id, ...home } }));
  });
}

async function seedCatalog(prisma: PrismaClient): Promise<CatalogIds> {
  const districtIds = new Map<string, string>();
  for (const { slug, name } of DISTRICTS) {
    const district = await prisma.district.upsert({
      where: { slug },
      create: { slug, name },
      update: { name },
    });
    districtIds.set(slug, district.id);
  }

  for (const { code, name } of SPECIES) {
    await prisma.species.upsert({ where: { code }, create: { code, name }, update: { name } });
  }

  const serviceIds = new Map<ServiceCode, string>();
  for (const { code, name, description } of SERVICES) {
    const service = await prisma.service.upsert({
      where: { code },
      create: { code, name, description },
      update: { name, description },
    });
    serviceIds.set(code, service.id);
  }

  const { code, name } = SPECIAL_CARE_CERTIFICATION;
  const specialCare = await prisma.certificationType.upsert({
    where: { code },
    create: { code, name },
    update: { name },
  });

  return { districtIds, serviceIds, specialCareTypeId: specialCare.id };
}

async function seedCaregiver(
  prisma: PrismaClient,
  caregiver: DemoCaregiver,
  { districtIds, serviceIds, specialCareTypeId }: CatalogIds,
  { today, validityMonths }: { today: Date; validityMonths: number },
): Promise<void> {
  const account = {
    firstName: caregiver.firstName,
    lastName: caregiver.lastName,
    birthDate: new Date(caregiver.birthDate),
    roles: [Role.CAREGIVER],
  };
  const profile = {
    status: CaregiverStatus.APPROVED,
    isActive: true,
    instantBooking: true,
    bio: caregiver.bio,
    vetStudentUntil:
      caregiver.vetStudentMonthsLeft === undefined
        ? null
        : addMonths(today, caregiver.vetStudentMonthsLeft),
    ratingCount: caregiver.ratings.count,
    ratingSum: caregiver.ratings.sum,
    specialRatingCount: caregiver.ratings.specialCount,
    specialRatingSum: caregiver.ratings.specialSum,
    completedBookingCount: caregiver.completedBookings,
    suspendedUntil: null,
  };

  await prisma.$transaction(async (tx) => {
    // Seeded caregivers can't sign in: passwordHash stays null.
    const user = await tx.user.upsert({
      where: { email: caregiver.email },
      create: { email: caregiver.email, ...account },
      update: account,
    });
    const caregiverId = user.id;
    await tx.caregiverProfile.upsert({
      where: { userId: caregiverId },
      create: { userId: caregiverId, ...profile },
      update: profile,
    });

    await tx.caregiverDistrict.deleteMany({ where: { caregiverId } });
    await tx.caregiverDistrict.createMany({
      data: caregiver.districts.map((slug) => ({
        caregiverId,
        districtId: required(districtIds.get(slug), slug),
      })),
    });

    await tx.caregiverServicePrice.deleteMany({ where: { caregiverId } });
    await tx.caregiverServicePrice.createMany({
      data: Object.entries(caregiver.prices).flatMap(([service, levels]) =>
        Object.entries(levels).map(([careLevel, priceCents]) => ({
          caregiverId,
          serviceId: required(serviceIds.get(service as ServiceCode), service),
          careLevel: careLevel as CareLevel,
          priceCents,
        })),
      ),
    });

    await tx.caregiverAvailability.deleteMany({ where: { caregiverId } });
    await tx.caregiverAvailability.createMany({
      data: caregiver.availability.map((window) => ({ caregiverId, ...window })),
    });

    await tx.caregiverCertification.deleteMany({ where: { caregiverId } });
    if (caregiver.specialCareMonthsAgo !== undefined) {
      const obtainedOn = addMonths(today, -caregiver.specialCareMonthsAgo);
      await tx.caregiverCertification.create({
        data: {
          caregiverId,
          certificationTypeId: specialCareTypeId,
          status: CertificationStatus.ACTIVE,
          obtainedOn,
          // RN-CUI-09: valid for the configured months, up to the day before.
          validUntil: addDays(addMonths(obtainedOn, validityMonths), -1),
        },
      });
    }
  });
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`The seed refers to ${name}, which isn't in the catalog`);
  }
  return value;
}
