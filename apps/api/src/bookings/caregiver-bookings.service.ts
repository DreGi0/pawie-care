import { Injectable } from '@nestjs/common';
import { caregiverDisplayName } from '../caregivers/caregivers.service.js';
import { caregiverProfileNotFound } from '../caregivers/caregiver-errors.js';
import {
  addMonths,
  atMinuteInElSalvador,
  dateInElSalvador,
  formatDateOnly,
} from '../common/time/calendar.js';
import { Clock } from '../common/time/clock.js';
import { BookingStatus, type Prisma } from '../generated/prisma/client.js';
import { PetsService } from '../pets/pets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bookingNotFound } from './booking-errors.js';
import { CONFIRMED_STATUSES, PAYOUT_PENDING_STATUSES, revealsContact } from './booking-status.js';
import type {
  CaregiverBookingResponse,
  CaregiverBookingsQuery,
  CaregiverEarningsResponse,
} from './caregiver-bookings.dto.js';
import { serviceDates } from './slot-plan.js';

const INCLUDE = {
  owner: true,
  district: true,
  service: true,
  slots: { include: { service: true }, orderBy: { startsAt: 'asc' } },
  pets: { include: { vetInstructions: true, pet: { select: { name: true } } } },
} satisfies Prisma.BookingInclude;

type CaregiverBooking = Prisma.BookingGetPayload<{ include: typeof INCLUDE }>;

/**
 * The caregiver's side of their bookings: the requests to answer (RN-RES-11), the
 * agenda and the earnings (RN-PAG-10). Answering lives in BookingsService, with the
 * rest of the status changes.
 */
@Injectable()
export class CaregiverBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pets: PetsService,
    private readonly clock: Clock,
  ) {}

  /**
   * The caregiver's bookings. The requests go first, the one whose answer is due first
   * on top (RN-RES-06); the rest follow by start. `upcoming` leaves out the bookings
   * that already ended, for the agenda.
   */
  async list(
    caregiverId: string,
    query: CaregiverBookingsQuery,
  ): Promise<CaregiverBookingResponse[]> {
    await this.requireProfile(caregiverId);
    const bookings = await this.prisma.booking.findMany({
      where: {
        caregiverId,
        ...(query.status && { status: { in: query.status } }),
        ...(query.upcoming && { endsAt: { gt: this.clock.now() } }),
      },
      include: INCLUDE,
      orderBy: { startsAt: 'asc' },
    });
    const urgency = (booking: CaregiverBooking) =>
      booking.status === BookingStatus.REQUESTED && booking.responseDueAt
        ? booking.responseDueAt.getTime()
        : Infinity;
    // A stable sort keeps the rest in the order of their start.
    bookings.sort((a, b) => urgency(a) - urgency(b));
    return Promise.all(bookings.map((booking) => this.toResponse(booking)));
  }

  async get(caregiverId: string, bookingId: string): Promise<CaregiverBookingResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, caregiverId },
      include: INCLUDE,
    });
    if (!booking) {
      throw bookingNotFound();
    }
    return this.toResponse(booking);
  }

  /**
   * RN-PAG-10: what the caregiver is to be paid for the bookings confirmed or held
   * (RN-PAG-03), what was paid and the total of the month in El Salvador, by the start
   * of each service. Payouts come with stage 10, so nothing is paid yet.
   */
  async earnings(caregiverId: string): Promise<CaregiverEarningsResponse> {
    await this.requireProfile(caregiverId);
    const today = dateInElSalvador(this.clock.now());
    const firstDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const [pending, month] = await Promise.all([
      this.prisma.booking.findMany({
        where: { caregiverId, status: { in: [...PAYOUT_PENDING_STATUSES] } },
        include: { service: true, pets: { include: { pet: { select: { name: true } } } } },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.booking.aggregate({
        where: {
          caregiverId,
          status: { in: [...CONFIRMED_STATUSES] },
          startsAt: {
            gte: atMinuteInElSalvador(firstDay, 0),
            lt: atMinuteInElSalvador(addMonths(firstDay, 1), 0),
          },
        },
        _sum: { caregiverPayoutCents: true },
      }),
    ]);
    return {
      pendingCents: pending.reduce((sum, booking) => sum + booking.caregiverPayoutCents, 0),
      paidCents: 0,
      month: formatDateOnly(firstDay).slice(0, 7),
      monthTotalCents: month._sum.caregiverPayoutCents ?? 0,
      pending: pending.map((booking) => ({
        bookingId: booking.id,
        status: booking.status,
        serviceCode: booking.service.code,
        startsAt: booking.startsAt.toISOString(),
        petNames: petNames(booking.pets),
        payoutCents: booking.caregiverPayoutCents,
      })),
    };
  }

  private async requireProfile(caregiverId: string): Promise<void> {
    const profile = await this.prisma.caregiverProfile.findUnique({
      where: { userId: caregiverId },
      select: { userId: true },
    });
    if (!profile) {
      throw caregiverProfileNotFound();
    }
  }

  private async toResponse(booking: CaregiverBooking): Promise<CaregiverBookingResponse> {
    const revealed = revealsContact(booking.status);
    const pets = await this.pets.bookingProfiles(
      serviceDates(booking.slots),
      booking.pets.map(({ petId, careLevel, vetInstructions }) => ({
        petId,
        careLevel,
        vetInstructionIds: vetInstructions.map(({ vetInstructionId }) => vetInstructionId),
      })),
    );
    return {
      id: booking.id,
      status: booking.status,
      serviceCode: booking.service.code,
      careLevel: booking.careLevel,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      // The columns keep past deadlines; only the one that's running matters.
      responseDueAt:
        booking.status === BookingStatus.REQUESTED
          ? (booking.responseDueAt?.toISOString() ?? null)
          : null,
      paymentDueAt:
        booking.status === BookingStatus.PENDING_PAYMENT
          ? (booking.paymentDueAt?.toISOString() ?? null)
          : null,
      owner: { displayName: caregiverDisplayName(booking.owner) },
      district: {
        id: booking.district.id,
        slug: booking.district.slug,
        name: booking.district.name,
      },
      // RN-CTA-04: the exact address and the emergency details only once confirmed.
      address: revealed ? { street: booking.addressStreet, details: booking.addressDetails } : null,
      emergency: revealed
        ? {
            contactName: booking.emergencyContactName,
            contactPhone: booking.emergencyContactPhone,
            vetName: booking.emergencyVetName,
            vetPhone: booking.emergencyVetPhone,
            preauthorizedCents: booking.emergencyPreauthorizedCents,
            clinicConsent: booking.emergencyClinicConsent,
          }
        : null,
      instructions: booking.instructions,
      slots: booking.slots.map((slot) => ({
        serviceCode: slot.service.code,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      })),
      // RN-RES-11, RN-PRE-04: the amounts saved when the booking was made (RN-PRE-07).
      earnings: {
        subtotalCents: booking.subtotalCents,
        commissionBp: booking.caregiverCommissionBp,
        commissionCents: booking.caregiverCommissionCents,
        payoutCents: booking.caregiverPayoutCents,
      },
      pets: pets.sort((a, b) => spanish.compare(a.name, b.name)),
      createdAt: booking.createdAt.toISOString(),
    };
  }
}

const spanish = new Intl.Collator('es');

function petNames(pets: readonly { pet: { name: string } }[]): string[] {
  return pets.map(({ pet }) => pet.name).sort((a, b) => spanish.compare(a, b));
}
