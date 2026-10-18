import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { BookingRules, CatalogResponse } from './catalog.dto.js';

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
      services,
      bookingRules,
    };
  }

  private async bookingRules(): Promise<BookingRules> {
    const settings = await this.settings.getMany([
      'bookings.maxPetsPerBooking',
      'bookings.minLeadTimeMinutes',
      'services.homeVisitMaxMinutes',
      'services.overnightHours',
    ]);
    return {
      maxPetsPerBooking: settings['bookings.maxPetsPerBooking'],
      minLeadTimeMinutes: settings['bookings.minLeadTimeMinutes'],
      homeVisitMinutes: settings['services.homeVisitMaxMinutes'],
      overnightStartMinute: settings['services.overnightHours'].startMinute,
      overnightEndMinute: settings['services.overnightHours'].endMinute,
    };
  }
}
