import { Injectable } from '@nestjs/common';
import { WALK_SPECIES_CODES } from '../bookings/walk.js';
import { CareTask, ServiceCode } from '../generated/prisma/enums.js';
import { CARE_TASK_GROUPS, CARE_TASK_NAMES, canBeOpenEnded } from '../pets/care-tasks.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { BookingRules, CareTaskOption, CatalogResponse } from './catalog.dto.js';

/** Sorts names as Spanish speakers expect: "Ñ" after "N", accents ignored. */
const spanish = new Intl.Collator('es', { sensitivity: 'base' });

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async catalog(): Promise<CatalogResponse> {
    const [districts, species, services, bookingRules] = await Promise.all([
      this.prisma.district.findMany({ select: { id: true, slug: true, name: true } }),
      this.prisma.species.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.service.findMany({
        select: { id: true, code: true, name: true, description: true },
        orderBy: { code: 'asc' },
      }),
      this.bookingRules(),
    ]);
    return {
      districts: districts.toSorted((a, b) => spanish.compare(a.name, b.name)),
      species,
      // RN-SER-05: the walk is only for dogs; the other services take every species.
      services: services.map((service) => ({
        ...service,
        speciesCodes:
          service.code === ServiceCode.WALK
            ? [...WALK_SPECIES_CODES]
            : species.map(({ code }) => code),
      })),
      bookingRules,
      careTasks: Object.values(CareTask).map(careTaskOption),
    };
  }

  private async bookingRules(): Promise<BookingRules> {
    const settings = await this.settings.getMany([
      'bookings.maxPetsPerBooking',
      'bookings.maxDogsPerWalk',
      'bookings.minLeadTimeMinutes',
      'services.homeVisitMaxMinutes',
      'services.walkDurationMinutes',
      'services.overnightHours',
    ]);
    return {
      maxPetsPerBooking: settings['bookings.maxPetsPerBooking'],
      maxDogsPerWalk: settings['bookings.maxDogsPerWalk'],
      minLeadTimeMinutes: settings['bookings.minLeadTimeMinutes'],
      homeVisitMinutes: settings['services.homeVisitMaxMinutes'],
      walkMinutes: settings['services.walkDurationMinutes'],
      overnightStartMinute: settings['services.overnightHours'].startMinute,
      overnightEndMinute: settings['services.overnightHours'].endMinute,
    };
  }
}

/** In the enum's order: clinical, assistance and prohibited tasks. */
function careTaskOption(code: CareTask): CareTaskOption {
  return {
    code,
    name: CARE_TASK_NAMES[code],
    group: CARE_TASK_GROUPS[code],
    canBeOpenEnded: canBeOpenEnded(code),
  };
}
