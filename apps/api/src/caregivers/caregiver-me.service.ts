import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Clock } from '../common/time/clock.js';
import { dateInElSalvador } from '../common/time/calendar.js';
import { FilesService } from '../files/files.service.js';
import {
  AppMode,
  CaregiverStatus,
  FilePurpose,
  Prisma,
  Role,
  type ServiceCode,
} from '../generated/prisma/client.js';
import { caregiverPayout } from '../pricing/booking-price.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { scheduleProblem } from './availability.js';
import { badgesOf } from './badges.js';
import { caregiverLevel, type LevelRequirement, RANKED_LEVELS } from './caregiver-level.js';
import { caregiverProfileNotFound } from './caregiver-errors.js';
import type {
  CaregiverLevelResponse,
  CaregiverMeResponse,
  CaregiverPricesResponse,
  LevelRequirementResponse,
  PriceQuoteRequest,
  PriceQuoteResponse,
  UpdateCaregiverMeRequest,
} from './caregiver-me.dto.js';
import { validCertification } from './certifications.js';
import { type PriceRange, resolvePrice } from './prices.js';
import { DOCUMENT_FILE_PURPOSES, pendingSetupSteps, visibleInSearch } from './setup-steps.js';

const profileInclude = {
  photoFile: true,
  districts: { include: { district: true } },
  availability: true,
  servicePrices: { include: { service: true } },
  documents: { include: { file: true } },
} satisfies Prisma.CaregiverProfileInclude;

type Profile = Prisma.CaregiverProfileGetPayload<{ include: typeof profileInclude }>;

/** How the out-of-range message names each service: "el precio de la visita". */
const PRICE_OF: Record<ServiceCode, string> = {
  HOME_VISIT: 'de la visita',
  OVERNIGHT_STAY: 'de la pernocta',
  WALK: 'del paseo',
};

const spanish = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * The caregiver's own side of the app (RN-CTA-06, RN-CUI-01 to RN-CUI-04, RN-CUI-16 to
 * RN-CUI-20): turning caregiver mode on, setting up the profile and the price
 * calculator. Every method needs the account's caregiver profile (arquitectura §4.19).
 */
@Injectable()
export class CaregiverMeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
    private readonly clock: Clock,
  ) {}

  /**
   * RN-CTA-06: turns caregiver mode on. The profile starts PENDING_APPROVAL and offers
   * every service at the suggested price (RN-CUI-17), and the account opens in
   * caregiver mode from now on.
   */
  async create(userId: string): Promise<CaregiverMeResponse> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const services = await tx.service.findMany({ select: { id: true } });
        await tx.caregiverProfile.create({
          data: {
            userId,
            servicePrices: { create: services.map(({ id }) => ({ serviceId: id })) },
          },
        });
        const { roles } = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        await tx.user.update({
          where: { id: userId },
          data: {
            lastMode: AppMode.CAREGIVER,
            ...(!roles.includes(Role.CAREGIVER) && { roles: { push: Role.CAREGIVER } }),
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          errorCode: 'CAREGIVER_PROFILE_EXISTS',
          message: 'Ya activaste el modo cuidador.',
        });
      }
      throw error;
    }
    return this.get(userId);
  }

  async get(userId: string): Promise<CaregiverMeResponse> {
    return this.toResponse(await this.find(userId));
  }

  /** RN-CUI-18: each field sent replaces what the caregiver had. */
  async update(userId: string, request: UpdateCaregiverMeRequest): Promise<CaregiverMeResponse> {
    const profile = await this.find(userId);

    if (request.documents?.length && profile.status === CaregiverStatus.APPROVED) {
      throw new ConflictException({
        errorCode: 'DOCUMENTS_LOCKED',
        message: 'Tus documentos ya están verificados, así que no se pueden cambiar.',
      });
    }
    for (const { kind, fileId } of request.documents ?? []) {
      await this.files.requireUploaded(userId, fileId, DOCUMENT_FILE_PURPOSES[kind]);
    }
    if (request.photoFileId) {
      await this.files.requireUploaded(userId, request.photoFileId, FilePurpose.CAREGIVER_PHOTO);
    }
    if (request.districtIds) {
      const found = await this.prisma.district.count({
        where: { id: { in: request.districtIds } },
      });
      if (found !== request.districtIds.length) {
        throw new UnprocessableEntityException({
          errorCode: 'UNKNOWN_DISTRICT',
          message: 'Elige distritos de la lista.',
        });
      }
    }
    if (request.availability) {
      const problem = scheduleProblem(request.availability);
      if (problem) {
        throw new UnprocessableEntityException({
          errorCode: 'INVALID_AVAILABILITY',
          message: problem,
        });
      }
    }
    const services = request.prices && (await this.prisma.service.findMany());
    if (request.prices) {
      const ranges = await this.settings.get('pricing.priceRanges');
      for (const { serviceCode, priceCents } of request.prices) {
        if (priceCents !== null && priceCents !== undefined) {
          requireInRange(serviceCode, priceCents, ranges[serviceCode][profile.level]);
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.caregiverProfile.update({
        where: { userId },
        data: {
          ...(request.bio !== undefined && { bio: request.bio || null }),
          ...(request.photoFileId !== undefined && { photoFileId: request.photoFileId }),
          ...(request.skills && { skills: request.skills }),
          ...(request.instantBooking !== undefined && { instantBooking: request.instantBooking }),
          ...(request.isPaused !== undefined && { isPaused: request.isPaused }),
        },
      });
      if (request.districtIds) {
        await tx.caregiverDistrict.deleteMany({ where: { caregiverId: userId } });
        await tx.caregiverDistrict.createMany({
          data: request.districtIds.map((districtId) => ({ caregiverId: userId, districtId })),
        });
      }
      if (request.availability) {
        await tx.caregiverAvailability.deleteMany({ where: { caregiverId: userId } });
        await tx.caregiverAvailability.createMany({
          data: request.availability.map(({ weekday, startMinute, endMinute }) => ({
            caregiverId: userId,
            weekday,
            startMinute,
            endMinute,
          })),
        });
      }
      if (request.prices && services) {
        await tx.caregiverServicePrice.deleteMany({ where: { caregiverId: userId } });
        await tx.caregiverServicePrice.createMany({
          data: request.prices.map(({ serviceCode, priceCents }) => ({
            caregiverId: userId,
            serviceId: services.find(({ code }) => code === serviceCode)!.id,
            priceCents: priceCents ?? null,
          })),
        });
      }
      for (const { kind, fileId } of request.documents ?? []) {
        await tx.caregiverDocument.upsert({
          where: { caregiverId_kind: { caregiverId: userId, kind } },
          create: { caregiverId: userId, kind, fileId },
          update: { fileId },
        });
      }
    });
    return this.get(userId);
  }

  /** RN-NIV-05: the caregiver's level and each requirement of the next one. */
  async level(userId: string): Promise<CaregiverLevelResponse> {
    const now = this.clock.now();
    const profile = await this.prisma.caregiverProfile.findUnique({
      where: { userId },
      select: {
        ratingCount: true,
        ratingSum: true,
        completedBookingCount: true,
        certifications: {
          where: validCertification(dateInElSalvador(now), now),
          select: { certificationType: { select: { code: true } } },
        },
      },
    });
    if (!profile) {
      throw caregiverProfileNotFound();
    }
    const { level, next } = caregiverLevel(
      {
        ...profile,
        certificationCodes: profile.certifications.map(
          ({ certificationType }) => certificationType.code,
        ),
      },
      await this.settings.get('levels.requirements'),
    );
    if (!next) {
      return { level, next: null };
    }

    const types = await this.prisma.certificationType.findMany({
      where: {
        code: {
          in: next.requirements.flatMap((r) => (r.kind === 'certification' ? [r.code] : [])),
        },
      },
    });
    return {
      level,
      next: {
        level: next.level,
        requirements: next.requirements.map((requirement) =>
          requirementResponse(
            requirement,
            requirement.kind === 'certification'
              ? (types.find(({ code }) => code === requirement.code)?.name ?? requirement.code)
              : null,
          ),
        ),
      },
    };
  }

  /**
   * RN-CUI-17, RN-PRE-01, RN-PRE-04: the price calculator. For each service, the
   * caregiver's price, what they get with it, the range and suggested price of their
   * level, and the suggested price of the next level.
   */
  async prices(userId: string): Promise<CaregiverPricesResponse> {
    const profile = await this.find(userId);
    const settings = await this.settings.getMany([
      'pricing.priceRanges',
      'pricing.caregiverCommissionBp',
    ] as const);
    const ranges = settings['pricing.priceRanges'];
    const nextLevel = RANKED_LEVELS[RANKED_LEVELS.indexOf(profile.level) + 1];
    const services = await this.prisma.service.findMany({ orderBy: { code: 'asc' } });

    return {
      level: profile.level,
      prices: services.map(({ id, code }) => {
        const offered = profile.servicePrices.find(({ serviceId }) => serviceId === id);
        const range = ranges[code][profile.level];
        const priceCents = resolvePrice(offered?.priceCents ?? null, range);
        return {
          serviceCode: code,
          offered: offered !== undefined,
          caregiverPriceCents: offered?.priceCents ?? null,
          priceCents,
          payoutCents: caregiverPayout(priceCents, settings['pricing.caregiverCommissionBp'])
            .caregiverPayoutCents,
          range,
          nextLevel: nextLevel
            ? { level: nextLevel, suggestedCents: ranges[code][nextLevel].suggestedCents }
            : null,
        };
      }),
    };
  }

  /** RN-CUI-17, RN-PRE-04: what the caregiver would get with a price, while they edit it. */
  async quote(
    userId: string,
    { serviceCode, priceCents }: PriceQuoteRequest,
  ): Promise<PriceQuoteResponse> {
    const profile = await this.find(userId);
    const settings = await this.settings.getMany([
      'pricing.priceRanges',
      'pricing.caregiverCommissionBp',
    ] as const);
    requireInRange(
      serviceCode,
      priceCents,
      settings['pricing.priceRanges'][serviceCode][profile.level],
    );
    return {
      serviceCode,
      priceCents,
      payoutCents: caregiverPayout(priceCents, settings['pricing.caregiverCommissionBp'])
        .caregiverPayoutCents,
    };
  }

  private async find(userId: string): Promise<Profile> {
    const profile = await this.prisma.caregiverProfile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    if (!profile) {
      throw caregiverProfileNotFound();
    }
    return profile;
  }

  private async toResponse(profile: Profile): Promise<CaregiverMeResponse> {
    const now = this.clock.now();
    const setup = {
      status: profile.status,
      documentKinds: profile.documents.map(({ kind }) => kind),
      welcomeCoursePassedAt: profile.welcomeCoursePassedAt,
      districtCount: profile.districts.length,
      availabilityCount: profile.availability.length,
      serviceCount: profile.servicePrices.length,
    };
    return {
      status: profile.status,
      isPaused: profile.isPaused,
      instantBooking: profile.instantBooking,
      bio: profile.bio,
      photoUrl: await this.files.downloadUrl(profile.photoFile),
      skills: profile.skills,
      districts: profile.districts
        .map(({ district }) => ({ id: district.id, slug: district.slug, name: district.name }))
        .toSorted((a, b) => spanish.compare(a.name, b.name)),
      availability: profile.availability
        .map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute }))
        .toSorted((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
      documents: await Promise.all(
        profile.documents
          .toSorted((a, b) => a.kind.localeCompare(b.kind))
          .map(async ({ kind, file }) => ({ kind, file: await this.files.toResponse(file) })),
      ),
      welcomeCoursePassedAt: profile.welcomeCoursePassedAt?.toISOString() ?? null,
      level: profile.level,
      badges: badgesOf(profile, dateInElSalvador(now)),
      pendingSteps: pendingSetupSteps(setup),
      visibleInSearch: visibleInSearch(
        { ...setup, isPaused: profile.isPaused, suspendedUntil: profile.suspendedUntil },
        now,
      ),
    };
  }
}

/** RN-CUI-17: the caregiver sets a price within the range of their level (RN-PRE-01). */
function requireInRange(serviceCode: ServiceCode, priceCents: number, range: PriceRange): void {
  if (priceCents < range.minCents || priceCents > range.maxCents) {
    throw new UnprocessableEntityException({
      errorCode: 'PRICE_OUT_OF_RANGE',
      message: `Para tu nivel, el precio ${PRICE_OF[serviceCode]} va de ${dollars(range.minCents)} a ${dollars(range.maxCents)}.`,
      details: { serviceCode, minCents: range.minCents, maxCents: range.maxCents },
    });
  }
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const REQUIREMENT_KINDS = {
  reviews: 'REVIEWS',
  averageRatingTenths: 'AVERAGE_RATING',
  completedBookings: 'COMPLETED_BOOKINGS',
  certifications: 'CERTIFICATIONS',
  certification: 'CERTIFICATION',
} as const;

function requirementResponse(
  requirement: LevelRequirement,
  certificationName: string | null,
): LevelRequirementResponse {
  if (requirement.kind === 'certification') {
    return {
      kind: REQUIREMENT_KINDS.certification,
      current: requirement.met ? 1 : 0,
      required: 1,
      met: requirement.met,
      certification: { code: requirement.code, name: certificationName ?? requirement.code },
    };
  }
  // The average is in tenths internally; the app shows it as a rating, like 4.8.
  const tenths = requirement.kind === 'averageRatingTenths' ? 10 : 1;
  return {
    kind: REQUIREMENT_KINDS[requirement.kind],
    current: requirement.current / tenths,
    required: requirement.required / tenths,
    met: requirement.met,
    certification: null,
  };
}
