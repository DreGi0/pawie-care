import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { recalculateLevel } from '../caregivers/recalculate-level.js';
import { addDays, addMonths, dateInElSalvador } from '../common/time/calendar.js';
import {
  CaregiverStatus,
  CertificationStatus,
  FilePurpose,
  type PrismaClient,
  Role,
  type ServiceCode,
} from '../generated/prisma/client.js';
import type { SettingKey, SettingValue } from '../settings/settings.registry.js';
import type { SettingsService } from '../settings/settings.service.js';
import { DEMO_CAREGIVERS, type DemoCaregiver } from './caregivers.js';
import {
  type CertificationCode,
  CERTIFICATION_TYPES,
  DISTRICTS,
  SERVICES,
  SPECIES,
} from './catalog.js';
import { DEMO_OWNER } from './demo-owner.js';
import { mediaName, type SeedMedia, seedPhoto } from './seed-media.js';

export interface SeedOptions {
  /** Dates such as the certifications' validity are relative to it. */
  now?: Date;
  /** DEMO_OWNER_PASSWORD. Without it, the demo owner isn't created. */
  demoOwnerPassword?: string;
  /**
   * DEMO_CAREGIVER_PHONE: a number of the team that every demo caregiver shows once a
   * booking is confirmed (RN-CTA-04). Without it, they have no phone.
   */
  demoCaregiverPhone?: string;
  /** Photos to upload. Without it, photos stay as they are. */
  media?: SeedMedia;
}

export interface SeedSummary {
  districts: number;
  species: number;
  services: number;
  caregivers: number;
  /** Email of the demo owner, or null when there was no password for it. */
  demoOwner: string | null;
  /** The phone the demo caregivers got, or null. */
  caregiverPhone: string | null;
  /** Photos found in the media directory and uploaded. */
  photos: number;
  /** Settings that didn't exist and got their initial value. */
  createdSettings: SettingKey[];
}

interface CatalogIds {
  districtIds: Map<string, string>;
  speciesIds: Map<string, string>;
  serviceIds: Map<ServiceCode, string>;
  certificationTypeIds: Map<CertificationCode, string>;
}

/**
 * Loads what the demo needs: the catalog, every setting of §15, the demo caregivers
 * and the demo owner. It can run any number of times:
 * - the catalog and the accounts are upserted by their natural keys (slug, code,
 *   email), and each caregiver's districts, prices, schedule and certifications are
 *   replaced, and their level recalculated from them (RN-NIV-04);
 * - settings that already exist keep their value, so it never undoes a settings:set.
 * Dates such as the certifications' validity are relative to `now`, so the demo data
 * stays current.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  settings: SettingsService,
  { now = new Date(), demoOwnerPassword, demoCaregiverPhone, media }: SeedOptions = {},
): Promise<SeedSummary> {
  const catalog = await seedCatalog(prisma);
  const createdSettings = await settings.createMissing({
    changedBy: 'seed',
    reason: 'Valor inicial de la sección 15 de las reglas de negocio',
  });
  const validityMonths = await settings.get('certifications.validityMonths');
  const requirements = await settings.get('levels.requirements');

  const today = dateInElSalvador(now);
  let photos = 0;
  for (const caregiver of DEMO_CAREGIVERS) {
    const caregiverId = await seedCaregiver(prisma, caregiver, catalog, {
      now,
      today,
      validityMonths,
      requirements,
      phone: demoCaregiverPhone ?? null,
    });
    if (media) {
      const photoFileId = await seedPhoto(prisma, media, {
        folder: 'caregivers',
        name: mediaName(caregiver.email.split('@')[0]),
        purpose: FilePurpose.CAREGIVER_PHOTO,
        uploadedById: caregiverId,
      });
      await prisma.caregiverProfile.update({
        where: { userId: caregiverId },
        data: { photoFileId },
      });
      photos += photoFileId ? 1 : 0;
    }
  }
  if (demoOwnerPassword !== undefined) {
    photos += await seedDemoOwner(prisma, demoOwnerPassword, catalog, { today, media });
  }

  return {
    districts: DISTRICTS.length,
    species: SPECIES.length,
    services: SERVICES.length,
    caregivers: DEMO_CAREGIVERS.length,
    demoOwner: demoOwnerPassword === undefined ? null : DEMO_OWNER.email,
    caregiverPhone: demoCaregiverPhone ?? null,
    photos,
    createdSettings,
  };
}

/** Returns how many pet photos it uploaded. */
async function seedDemoOwner(
  prisma: PrismaClient,
  password: string,
  { districtIds, speciesIds }: CatalogIds,
  { today, media }: { today: Date; media?: SeedMedia },
): Promise<number> {
  const { email, address, pets, ...owner } = DEMO_OWNER;
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

  const { ownerId, petIds } = await prisma.$transaction(async (tx) => {
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

    // Pets are matched by name, and their care needs are replaced.
    const ids = new Map<string, string>();
    for (const { careNeeds, species, ...pet } of pets) {
      const data = {
        name: pet.name,
        speciesId: required(speciesIds.get(species), species),
        breed: pet.breed,
        birthDate: new Date(pet.birthDate),
        birthDateIsApproximate: pet.birthDateIsApproximate ?? false,
        sex: pet.sex,
        weightGrams: pet.weightGrams,
        isSterilized: pet.isSterilized,
        temperament: pet.temperament ?? null,
        handlingNotes: pet.handlingNotes ?? null,
        healthConditions: pet.healthConditions ?? null,
        medications: pet.medications ?? null,
        archivedAt: null,
      };
      const existingPet = await tx.pet.findFirst({ where: { ownerId: user.id, name: pet.name } });
      const saved = existingPet
        ? await tx.pet.update({ where: { id: existingPet.id }, data })
        : await tx.pet.create({ data: { ownerId: user.id, ...data } });
      await tx.petCareNeed.deleteMany({ where: { petId: saved.id } });
      await tx.petCareNeed.createMany({
        data: careNeeds.map((need) => ({
          petId: saved.id,
          startsOn: addMonths(today, -6),
          ...need,
        })),
      });
      ids.set(pet.name, saved.id);
    }
    return { ownerId: user.id, petIds: ids };
  });

  if (!media) {
    return 0;
  }
  let photos = 0;
  for (const [name, petId] of petIds) {
    const photoFileId = await seedPhoto(prisma, media, {
      folder: 'pets',
      name: mediaName(name),
      purpose: FilePurpose.PET_PHOTO,
      uploadedById: ownerId,
    });
    await prisma.pet.update({ where: { id: petId }, data: { photoFileId } });
    photos += photoFileId ? 1 : 0;
  }
  return photos;
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

  const speciesIds = new Map<string, string>();
  for (const { code, name } of SPECIES) {
    const species = await prisma.species.upsert({
      where: { code },
      create: { code, name },
      update: { name },
    });
    speciesIds.set(code, species.id);
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

  const certificationTypeIds = new Map<CertificationCode, string>();
  for (const { code, name } of CERTIFICATION_TYPES) {
    const type = await prisma.certificationType.upsert({
      where: { code },
      create: { code, name },
      update: { name },
    });
    certificationTypeIds.set(code, type.id);
  }

  return { districtIds, speciesIds, serviceIds, certificationTypeIds };
}

async function seedCaregiver(
  prisma: PrismaClient,
  caregiver: DemoCaregiver,
  { districtIds, serviceIds, certificationTypeIds }: CatalogIds,
  {
    now,
    today,
    validityMonths,
    requirements,
    phone,
  }: {
    now: Date;
    today: Date;
    validityMonths: number;
    requirements: SettingValue<'levels.requirements'>;
    phone: string | null;
  },
): Promise<string> {
  const account = {
    firstName: caregiver.firstName,
    lastName: caregiver.lastName,
    birthDate: new Date(caregiver.birthDate),
    roles: [Role.CAREGIVER],
    phone,
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
    skills: caregiver.skills ?? [],
    suspendedUntil: null,
  };

  return prisma.$transaction(async (tx) => {
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
      data: Object.entries(caregiver.prices).map(([service, priceCents]) => ({
        caregiverId,
        serviceId: required(serviceIds.get(service as ServiceCode), service),
        priceCents,
      })),
    });

    await tx.caregiverAvailability.deleteMany({ where: { caregiverId } });
    await tx.caregiverAvailability.createMany({
      data: caregiver.availability.map((window) => ({ caregiverId, ...window })),
    });

    await tx.caregiverCertification.deleteMany({ where: { caregiverId } });
    for (const [code, monthsAgo] of Object.entries(caregiver.certifications ?? {})) {
      const obtainedOn = addMonths(today, -monthsAgo);
      await tx.caregiverCertification.create({
        data: {
          caregiverId,
          certificationTypeId: required(certificationTypeIds.get(code as CertificationCode), code),
          status: CertificationStatus.ACTIVE,
          obtainedOn,
          // RN-CUI-09: valid for the configured months, up to the day before.
          validUntil: addDays(addMonths(obtainedOn, validityMonths), -1),
        },
      });
    }
    // RN-NIV-04: the level follows the ratings, the services and the certifications.
    await recalculateLevel(tx, caregiverId, requirements, now);
    return caregiverId;
  });
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`The seed refers to ${name}, which isn't in the catalog`);
  }
  return value;
}
