import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { SlotResponse } from '../bookings/schedule.dto.js';
import { planSlots, serviceDates } from '../bookings/slot-plan.js';
import { dateInElSalvador } from '../common/time/calendar.js';
import { FilesService } from '../files/files.service.js';
import {
  CaregiverStatus,
  CareLevel,
  CertificationStatus,
  Prisma,
  type ServiceCode,
} from '../generated/prisma/client.js';
import { careLevelOn } from '../pets/care-level.js';
import { CARE_TASK_LABELS } from '../pets/care-tasks.js';
import { PetsService } from '../pets/pets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SettingValue } from '../settings/settings.registry.js';
import { SettingsService } from '../settings/settings.service.js';
import { overlaps, scheduleCovers } from './availability.js';
import type {
  CaregiverPrice,
  CaregiverProfileResponse,
  CaregiverSearchResponse,
  CaregiverSearchResult,
  CaregiverSummary,
  SearchCaregiversRequest,
} from './caregivers.dto.js';
import { resolvePrice } from './prices.js';
import { SPECIAL_CARE_CERTIFICATION } from './special-care.js';

const CAREGIVER_INCLUDE = {
  user: true,
  photoFile: true,
  districts: { include: { district: true } },
  servicePrices: { include: { service: true } },
  availability: true,
  certifications: {
    where: {
      status: CertificationStatus.ACTIVE,
      certificationType: { code: SPECIAL_CARE_CERTIFICATION.code },
    },
  },
} satisfies Prisma.CaregiverProfileInclude;

type Caregiver = Prisma.CaregiverProfileGetPayload<{ include: typeof CAREGIVER_INCLUDE }>;
type PriceRanges = SettingValue<'pricing.priceRanges'>;

const spanish = new Intl.Collator('es', { sensitivity: 'base' });

/** Caregiver profiles and search (RN-RES-01, RN-RES-02). */
@Injectable()
export class CaregiversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
    private readonly pets: PetsService,
  ) {}

  async profile(caregiverId: string): Promise<CaregiverProfileResponse> {
    const now = new Date();
    const caregiver = await this.prisma.caregiverProfile.findFirst({
      where: { userId: caregiverId, ...visibleAt(now) },
      include: CAREGIVER_INCLUDE,
    });
    if (!caregiver) {
      throw new NotFoundException({
        errorCode: 'CAREGIVER_NOT_FOUND',
        message: 'No encontramos a ese cuidador.',
      });
    }
    const ranges = await this.settings.get('pricing.priceRanges');
    const certified = hasSpecialCare(caregiver, dateInElSalvador(now), now);

    return Object.assign(await this.summary(caregiver, now), {
      bio: caregiver.bio,
      districts: caregiver.districts
        .map(({ district }) => ({ id: district.id, slug: district.slug, name: district.name }))
        .toSorted((a, b) => spanish.compare(a.name, b.name)),
      prices: caregiver.servicePrices
        .filter(({ careLevel }) => careLevel === CareLevel.STANDARD || certified)
        .map((row) => price(row.service.code, row.careLevel, row.priceCents, ranges))
        .toSorted(
          (a, b) =>
            a.serviceCode.localeCompare(b.serviceCode) || a.careLevel.localeCompare(b.careLevel),
        ),
    });
  }

  /**
   * RN-RES-01: approved and active caregivers who cover the district, offer every
   * service of the slots at the booking's level, are free on every slot and, for a
   * Special booking, hold a ⭐ valid through its last day.
   */
  async search(
    ownerId: string,
    request: SearchCaregiversRequest,
  ): Promise<CaregiverSearchResponse> {
    const now = new Date();
    const {
      'pricing.priceRanges': ranges,
      'bookings.maxPetsPerBooking': maxPets,
      'services.homeVisitMaxMinutes': visitMinutes,
      'services.overnightHours': overnight,
      'bookings.minLeadTimeMinutes': minLeadTimeMinutes,
    } = await this.settings.getMany([
      'pricing.priceRanges',
      'bookings.maxPetsPerBooking',
      'services.homeVisitMaxMinutes',
      'services.overnightHours',
      'bookings.minLeadTimeMinutes',
    ]);

    // RN-RES-03
    if (new Set(request.petIds).size > maxPets) {
      throw new UnprocessableEntityException({
        errorCode: 'TOO_MANY_PETS',
        message: `Puedes reservar hasta ${maxPets} mascotas a la vez.`,
      });
    }
    const slots = planSlots(
      request,
      {
        homeVisitMinutes: visitMinutes,
        overnightStartMinute: overnight.startMinute,
        overnightEndMinute: overnight.endMinute,
        minLeadTimeMinutes,
      },
      now,
    );
    const careLevel = await this.bookingCareLevel(ownerId, request.petIds, serviceDates(slots));
    await this.requireDistrict(request.districtId);

    const { to: lastDate } = serviceDates(slots);
    const serviceCodes = [...new Set(slots.map(({ serviceCode }) => serviceCode))];
    const candidates = await this.prisma.caregiverProfile.findMany({
      where: {
        ...visibleAt(now),
        // RN-CTA-01: an owner who is also a caregiver doesn't find themselves.
        userId: { not: ownerId },
        districts: { some: { districtId: request.districtId } },
        AND: serviceCodes.map((code) => ({
          servicePrices: { some: { careLevel, service: { code } } },
        })),
        ...(careLevel === CareLevel.SPECIAL && {
          certifications: { some: validSpecialCare(lastDate, now) },
        }),
      },
      include: CAREGIVER_INCLUDE,
    });

    const firstStart = slots[0].startsAt;
    const lastEnd = new Date(Math.max(...slots.map(({ endsAt }) => endsAt.getTime())));
    const booked = await this.prisma.bookingSlot.findMany({
      where: {
        caregiverId: { in: candidates.map(({ userId }) => userId) },
        blocksCalendar: true,
        startsAt: { lt: lastEnd },
        endsAt: { gt: firstStart },
      },
      select: { caregiverId: true, startsAt: true, endsAt: true },
    });
    const available = candidates.filter((caregiver) =>
      slots.every(
        (slot) =>
          scheduleCovers(caregiver.availability, slot) &&
          !booked.some((taken) => taken.caregiverId === caregiver.userId && overlaps(taken, slot)),
      ),
    );

    const results: CaregiverSearchResult[] = await Promise.all(
      available.map(async (caregiver) =>
        Object.assign(await this.summary(caregiver, now), {
          prices: serviceCodes.map((code) => {
            const row = caregiver.servicePrices.find(
              (candidate) => candidate.service.code === code && candidate.careLevel === careLevel,
            );
            return price(code, careLevel, row?.priceCents ?? null, ranges);
          }),
        }),
      ),
    );
    return {
      careLevel,
      slots: slots.map(({ serviceCode, startsAt, endsAt }): SlotResponse => ({
        serviceCode,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      })),
      results: results.toSorted(byRanking),
    };
  }

  /**
   * RN-MAS-05, RN-PRE-02: SPECIAL if any pet is Special on those dates. A pet with an
   * active prohibited need stops the search, saying why (RN-MAS-09).
   */
  private async bookingCareLevel(
    ownerId: string,
    petIds: readonly string[],
    { from, to }: { from: Date; to: Date },
  ): Promise<CareLevel> {
    const pets = await this.pets.findForBooking(ownerId, petIds);
    const levels = pets.map((pet) => ({ pet, ...careLevelOn(pet.careNeeds, from, to) }));
    const blocked = levels.filter(({ prohibitedTasks }) => prohibitedTasks.length > 0);
    if (blocked.length > 0) {
      throw new UnprocessableEntityException({
        errorCode: 'PET_NOT_BOOKABLE',
        message: blocked
          .map(
            ({ pet, prohibitedTasks }) =>
              `Ningún cuidador de Pawie puede ${prohibitedTasks.map((task) => CARE_TASK_LABELS[task]).join(' ni ')}, así que ${pet.name} no se puede reservar en esas fechas.`,
          )
          .join(' '),
        details: {
          pets: blocked.map(({ pet, prohibitedTasks }) => ({
            petId: pet.id,
            name: pet.name,
            tasks: prohibitedTasks,
          })),
        },
      });
    }
    return levels.some(({ careLevel }) => careLevel === CareLevel.SPECIAL)
      ? CareLevel.SPECIAL
      : CareLevel.STANDARD;
  }

  private async requireDistrict(districtId: string): Promise<void> {
    const district = await this.prisma.district.findUnique({ where: { id: districtId } });
    if (!district) {
      throw new UnprocessableEntityException({
        errorCode: 'UNKNOWN_DISTRICT',
        message: 'Elige un distrito de la lista.',
      });
    }
  }

  private async summary(caregiver: Caregiver, now: Date): Promise<CaregiverSummary> {
    const today = dateInElSalvador(now);
    const { ratingCount, ratingSum } = caregiver;
    return {
      id: caregiver.userId,
      displayName: `${caregiver.user.firstName} ${caregiver.user.lastName.charAt(0)}.`,
      photoUrl: await this.files.downloadUrl(caregiver.photoFile),
      hasSpecialCareCertification: hasSpecialCare(caregiver, today, now),
      isVetStudent: caregiver.vetStudentUntil !== null && caregiver.vetStudentUntil >= today,
      rating: ratingCount === 0 ? null : Math.round((ratingSum * 10) / ratingCount) / 10,
      ratingCount,
      completedBookingCount: caregiver.completedBookingCount,
      instantBooking: caregiver.instantBooking,
    };
  }
}

/** RN-RES-01, RN-CAN-05: approved, active and not suspended. */
function visibleAt(now: Date) {
  return {
    status: CaregiverStatus.APPROVED,
    isActive: true,
    OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }],
  } satisfies Prisma.CaregiverProfileWhereInput;
}

/** An active ⭐ that isn't suspended and lasts through `lastDate` (RN-CUI-09, RN-CUI-10). */
function validSpecialCare(lastDate: Date, now: Date) {
  return {
    status: CertificationStatus.ACTIVE,
    certificationType: { code: SPECIAL_CARE_CERTIFICATION.code },
    validUntil: { gte: lastDate },
    OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }],
  } satisfies Prisma.CaregiverCertificationWhereInput;
}

function hasSpecialCare(caregiver: Caregiver, today: Date, now: Date): boolean {
  return caregiver.certifications.some(
    ({ validUntil, suspendedUntil }) =>
      validUntil >= today && (suspendedUntil === null || suspendedUntil <= now),
  );
}

function price(
  serviceCode: ServiceCode,
  careLevel: CareLevel,
  priceCents: number | null,
  ranges: PriceRanges,
): CaregiverPrice {
  return {
    serviceCode,
    careLevel,
    priceCents: resolvePrice(priceCents, ranges[serviceCode][careLevel]),
  };
}

/** Best rated first, then the most experienced; caregivers without ratings go last. */
function byRanking(a: CaregiverSummary, b: CaregiverSummary): number {
  return (
    (b.rating ?? -1) - (a.rating ?? -1) ||
    b.completedBookingCount - a.completedBookingCount ||
    spanish.compare(a.displayName, b.displayName)
  );
}
