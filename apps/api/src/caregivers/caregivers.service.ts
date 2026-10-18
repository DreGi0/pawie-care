import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { slotTaken } from '../bookings/booking-errors.js';
import type { ScheduleRequest, SlotResponse } from '../bookings/schedule.dto.js';
import { type PlannedSlot, planSlots, serviceDates } from '../bookings/slot-plan.js';
import { dateInElSalvador } from '../common/time/calendar.js';
import { FilesService } from '../files/files.service.js';
import {
  CaregiverStatus,
  CareLevel,
  CertificationStatus,
  Prisma,
  type ServiceCode,
} from '../generated/prisma/client.js';
import { careLevelOn, type PetCareLevel } from '../pets/care-level.js';
import { CARE_TASK_LABELS } from '../pets/care-tasks.js';
import { PetsService } from '../pets/pets.service.js';
import type { CaregiverServicePrice } from '../pricing/booking-price.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SettingValue } from '../settings/settings.registry.js';
import { SettingsService, type SettingValues } from '../settings/settings.service.js';
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

/** The settings a search or a booking request is checked against (§15). */
export const BOOKING_PLAN_SETTING_KEYS = [
  'bookings.maxPetsPerBooking',
  'bookings.minLeadTimeMinutes',
  'services.homeVisitMaxMinutes',
  'services.overnightHours',
  'pricing.priceRanges',
] as const;

export type BookingPlanSettings = SettingValues<typeof BOOKING_PLAN_SETTING_KEYS>;

/** What a search and a booking both ask for: the owner's pets, the schedule and the district. */
export type BookingPlanRequest = ScheduleRequest & {
  petIds: readonly string[];
  districtId: string;
};

/** A pet of the request with its care needs and its level on the dates of the service. */
export type BookingPlanPet = Awaited<ReturnType<PetsService['findForBooking']>>[number] &
  PetCareLevel;

/** A search or booking request, checked as far as it goes without a caregiver. */
export interface BookingPlan {
  /** Sorted by start. */
  slots: PlannedSlot[];
  /** The first and last date of the service in El Salvador, both inclusive (RN-MAS-05). */
  dates: { from: Date; to: Date };
  pets: BookingPlanPet[];
  /** RN-MAS-05, RN-PRE-02: SPECIAL if any pet is Special on those dates. */
  careLevel: CareLevel;
  districtId: string;
  /** The services of the slots: an overnight stay can have daytime visits (RN-SER-03). */
  serviceCodes: ServiceCode[];
}

/** A caregiver who can take a booking, with their price for each of its services. */
export interface BookableCaregiver {
  caregiverId: string;
  /** RN-CUI-16 */
  instantBooking: boolean;
  prices: CaregiverServicePrice[];
}

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
    const settings = await this.settings.getMany(BOOKING_PLAN_SETTING_KEYS);
    const plan = await this.planBooking(ownerId, request, settings, now);

    const candidates = await this.eligibleCaregivers(ownerId, plan, now);
    const booked = await this.blockingSlots(
      candidates.map(({ userId }) => userId),
      plan.slots,
    );
    const available = candidates.filter(
      (caregiver) =>
        coversEverySlot(caregiver, plan.slots) &&
        !booked.some(
          (taken) =>
            taken.caregiverId === caregiver.userId &&
            plan.slots.some((slot) => overlaps(taken, slot)),
        ),
    );

    const results: CaregiverSearchResult[] = await Promise.all(
      available.map(async (caregiver) =>
        Object.assign(await this.summary(caregiver, now), {
          prices: servicePrices(caregiver, plan, settings['pricing.priceRanges']).map(
            ({ serviceCode, caregiverPriceCents, range }) => ({
              serviceCode,
              careLevel: plan.careLevel,
              priceCents: resolvePrice(caregiverPriceCents, range),
            }),
          ),
        }),
      ),
    );
    return {
      careLevel: plan.careLevel,
      slots: plan.slots.map(({ serviceCode, startsAt, endsAt }): SlotResponse => ({
        serviceCode,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      })),
      results: results.toSorted(byRanking),
    };
  }

  /**
   * Checks what a search or a booking asks for: the number of pets (RN-RES-03), the
   * schedule (planSlots), the pets' care level and prohibited needs on the dates of the
   * service (RN-MAS-05, RN-MAS-09), and the district.
   */
  async planBooking(
    ownerId: string,
    request: BookingPlanRequest,
    settings: BookingPlanSettings,
    now: Date,
  ): Promise<BookingPlan> {
    const maxPets = settings['bookings.maxPetsPerBooking'];
    if (new Set(request.petIds).size > maxPets) {
      throw new UnprocessableEntityException({
        errorCode: 'TOO_MANY_PETS',
        message: `Puedes reservar hasta ${maxPets} mascotas a la vez.`,
      });
    }
    const overnight = settings['services.overnightHours'];
    const slots = planSlots(
      request,
      {
        homeVisitMinutes: settings['services.homeVisitMaxMinutes'],
        overnightStartMinute: overnight.startMinute,
        overnightEndMinute: overnight.endMinute,
        minLeadTimeMinutes: settings['bookings.minLeadTimeMinutes'],
      },
      now,
    );
    const dates = serviceDates(slots);
    const pets = await this.petsOnDates(ownerId, request.petIds, dates);
    await this.requireDistrict(request.districtId);

    return {
      slots,
      dates,
      pets,
      // RN-PRE-02: one Special pet makes the whole booking Special.
      careLevel: pets.some(({ careLevel }) => careLevel === CareLevel.SPECIAL)
        ? CareLevel.SPECIAL
        : CareLevel.STANDARD,
      districtId: request.districtId,
      serviceCodes: [...new Set(slots.map(({ serviceCode }) => serviceCode))],
    };
  }

  /**
   * The caregiver of a booking, checked exactly as the search checks them, so the
   * search and the booking never disagree (RN-RES-01). Throws SLOT_TAKEN when only
   * another booking is in the way, and CAREGIVER_UNAVAILABLE for anything else.
   */
  async bookableCaregiver(
    ownerId: string,
    caregiverId: string,
    plan: BookingPlan,
    settings: BookingPlanSettings,
    now: Date,
  ): Promise<BookableCaregiver> {
    const [caregiver] = await this.eligibleCaregivers(ownerId, plan, now, caregiverId);
    if (!caregiver || !coversEverySlot(caregiver, plan.slots)) {
      throw new ConflictException({
        errorCode: 'CAREGIVER_UNAVAILABLE',
        message:
          'Este cuidador no puede tomar esa reserva. Revisa las fechas, el distrito y las mascotas, o busca de nuevo.',
      });
    }
    const booked = await this.blockingSlots([caregiverId], plan.slots);
    if (booked.some((taken) => plan.slots.some((slot) => overlaps(taken, slot)))) {
      throw slotTaken();
    }
    return {
      caregiverId,
      instantBooking: caregiver.instantBooking,
      prices: servicePrices(caregiver, plan, settings['pricing.priceRanges']),
    };
  }

  /**
   * Who could take the booking, before looking at their schedule and other bookings:
   * visible, covering the district, offering each service at the booking's level and,
   * for a Special booking, holding a ⭐ valid through its last day (RN-CUI-09).
   */
  private eligibleCaregivers(
    ownerId: string,
    plan: BookingPlan,
    now: Date,
    caregiverId?: string,
  ): Promise<Caregiver[]> {
    return this.prisma.caregiverProfile.findMany({
      where: {
        ...visibleAt(now),
        // RN-CTA-01: an owner who is also a caregiver doesn't find or book themselves.
        userId: { not: ownerId, ...(caregiverId !== undefined && { equals: caregiverId }) },
        districts: { some: { districtId: plan.districtId } },
        AND: plan.serviceCodes.map((code) => ({
          servicePrices: { some: { careLevel: plan.careLevel, service: { code } } },
        })),
        ...(plan.careLevel === CareLevel.SPECIAL && {
          certifications: { some: validSpecialCare(plan.dates.to, now) },
        }),
      },
      include: CAREGIVER_INCLUDE,
    });
  }

  /** The caregivers' slots that hold their time between the first and the last slot. */
  private blockingSlots(caregiverIds: string[], slots: readonly PlannedSlot[]) {
    const firstStart = slots[0].startsAt;
    const lastEnd = new Date(Math.max(...slots.map(({ endsAt }) => endsAt.getTime())));
    return this.prisma.bookingSlot.findMany({
      where: {
        caregiverId: { in: caregiverIds },
        blocksCalendar: true,
        startsAt: { lt: lastEnd },
        endsAt: { gt: firstStart },
      },
      select: { caregiverId: true, startsAt: true, endsAt: true },
    });
  }

  /**
   * RN-MAS-05: each pet's level on the dates of the service. A pet with an active
   * prohibited need stops the request, saying why (RN-MAS-09).
   */
  private async petsOnDates(
    ownerId: string,
    petIds: readonly string[],
    { from, to }: { from: Date; to: Date },
  ): Promise<BookingPlanPet[]> {
    const pets = await this.pets.findForBooking(ownerId, petIds);
    const levels = pets.map((pet) => ({ ...pet, ...careLevelOn(pet.careNeeds, from, to) }));
    const blocked = levels.filter(({ prohibitedTasks }) => prohibitedTasks.length > 0);
    if (blocked.length > 0) {
      throw new UnprocessableEntityException({
        errorCode: 'PET_NOT_BOOKABLE',
        message: blocked
          .map(
            ({ name, prohibitedTasks }) =>
              `Ningún cuidador de Pawie puede ${prohibitedTasks.map((task) => CARE_TASK_LABELS[task]).join(' ni ')}, así que ${name} no se puede reservar en esas fechas.`,
          )
          .join(' '),
        details: {
          pets: blocked.map(({ id, name, prohibitedTasks }) => ({
            petId: id,
            name,
            tasks: prohibitedTasks,
          })),
        },
      });
    }
    return levels;
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

/** Whether the weekly schedule covers every slot. */
function coversEverySlot(caregiver: Caregiver, slots: readonly PlannedSlot[]): boolean {
  return slots.every((slot) => scheduleCovers(caregiver.availability, slot));
}

/**
 * The caregiver's price for each service of the booking at its level, as the
 * caregiver set it (null for the suggested one), with the range in force. Eligible
 * caregivers offer every service of the booking at its level.
 */
function servicePrices(
  caregiver: Caregiver,
  { serviceCodes, careLevel }: BookingPlan,
  ranges: PriceRanges,
): CaregiverServicePrice[] {
  return serviceCodes.map((serviceCode) => ({
    serviceCode,
    caregiverPriceCents:
      caregiver.servicePrices.find(
        (row) => row.service.code === serviceCode && row.careLevel === careLevel,
      )?.priceCents ?? null,
    range: ranges[serviceCode][careLevel],
  }));
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
