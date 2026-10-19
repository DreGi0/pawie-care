import { ConflictException, Injectable } from '@nestjs/common';
import { AddressesService } from '../addresses/addresses.service.js';
import {
  type BookingPlan,
  BOOKING_PLAN_SETTING_KEYS,
  CaregiversService,
  caregiverDisplayName,
} from '../caregivers/caregivers.service.js';
import { Clock } from '../common/time/clock.js';
import { FilesService } from '../files/files.service.js';
import {
  type Booking,
  BookingStatus,
  Prisma,
  type ServiceCode,
} from '../generated/prisma/client.js';
import { currentPayment } from '../payments/booking-payment.js';
import { activeOn } from '../pets/care-level.js';
import { CARE_TASK_GROUPS } from '../pets/care-tasks.js';
import { PRICING_SETTING_KEYS, quoteBooking, ratesFrom } from '../pricing/booking-price.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { bookingNotFound, isSlotOverlap, slotTaken } from './booking-errors.js';
import { BookingDeadlines } from './booking-deadlines.js';
import { BookingStateMachine } from './booking-state-machine.js';
import { blocksCalendar, canTransition, revealsContact } from './booking-status.js';
import type { BookingResponse, CreateBookingRequest } from './bookings.dto.js';
import { paymentDeadline, responseDeadline } from './deadlines.js';

/** Everything a booking request reads from the settings (§15), in one query. */
const BOOKING_SETTING_KEYS = [
  ...BOOKING_PLAN_SETTING_KEYS,
  ...PRICING_SETTING_KEYS,
  'bookings.caregiverResponseMinutes',
  'bookings.paymentWindowMinutes',
] as const;

const BOOKING_INCLUDE = {
  service: true,
  district: true,
  caregiver: { include: { user: true, photoFile: true } },
  pets: { include: { pet: true, vetInstructions: true } },
  slots: { include: { service: true }, orderBy: { startsAt: 'asc' } },
  payments: true,
} satisfies Prisma.BookingInclude;

type BookingWithDetails = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

/** Booking requests, the owner's bookings and their status changes (RN-RES). */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly caregivers: CaregiversService,
    private readonly addresses: AddressesService,
    private readonly files: FilesService,
    private readonly stateMachine: BookingStateMachine,
    private readonly deadlines: BookingDeadlines,
    private readonly clock: Clock,
  ) {}

  /**
   * RN-RES-03, RN-RES-04: books a caregiver the search would show for these pets and
   * slots. The booking copies the address (RN-CTA-04), the prices and rates in force
   * (RN-PRE-07), and the vet instructions of the clinical tasks active on its dates.
   * With instant booking it waits for payment (RN-CUI-16, RN-RES-07); otherwise, for
   * the caregiver's answer (RN-RES-06).
   */
  async create(ownerId: string, request: CreateBookingRequest): Promise<BookingResponse> {
    const now = this.clock.now();
    const address = await this.addresses.findOwn(ownerId, request.addressId);
    const settings = await this.settings.getMany(BOOKING_SETTING_KEYS);
    const { serviceCode, nights, visits, petIds } = request;
    const plan = await this.caregivers.planBooking(
      ownerId,
      { serviceCode, nights, visits, petIds, districtId: address.districtId },
      settings,
      now,
    );
    const caregiver = await this.caregivers.bookableCaregiver(
      ownerId,
      request.caregiverId,
      plan,
      settings,
      now,
    );
    const quote = quoteBooking({
      slots: plan.slots,
      careLevel: plan.careLevel,
      petCount: plan.pets.length,
      prices: caregiver.prices,
      rates: ratesFrom(settings),
    });

    const startsAt = plan.slots[0].startsAt;
    const status = caregiver.instantBooking
      ? BookingStatus.PENDING_PAYMENT
      : BookingStatus.REQUESTED;
    const serviceIds = await this.serviceIds();
    const { emergency } = request;

    let booking: Booking;
    try {
      booking = await this.prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: {
            ownerId,
            caregiverId: caregiver.caregiverId,
            serviceId: serviceIds[serviceCode],
            careLevel: plan.careLevel,
            status,
            blocksCalendar: blocksCalendar(status),
            startsAt,
            endsAt: new Date(Math.max(...plan.slots.map(({ endsAt }) => endsAt.getTime()))),
            addressId: address.id,
            districtId: address.districtId,
            addressStreet: address.street,
            addressDetails: address.details,
            instructions: request.instructions || null,
            emergencyContactName: emergency.contactName,
            emergencyContactPhone: emergency.contactPhone,
            emergencyVetName: emergency.vetName || null,
            emergencyVetPhone: emergency.vetPhone || null,
            emergencyPreauthorizedCents: emergency.preauthorizedCents,
            emergencyClinicConsent: emergency.clinicConsent,
            ...(status === BookingStatus.REQUESTED
              ? {
                  responseDueAt: responseDeadline(
                    now,
                    startsAt,
                    settings['bookings.caregiverResponseMinutes'],
                  ),
                }
              : {
                  paymentDueAt: paymentDeadline(
                    now,
                    startsAt,
                    settings['bookings.paymentWindowMinutes'],
                  ),
                }),
            // RN-PRE-07: the amounts and the rates in force, which have the columns' names.
            ...quote.amounts,
            ...quote.snapshot.rates,
            pricingSnapshot: quote.snapshot as unknown as Prisma.InputJsonObject,
            pets: {
              create: plan.pets.map(({ id, careLevel }) => ({ petId: id, careLevel })),
            },
            slots: {
              create: quote.slots.map((slot) => ({
                serviceId: serviceIds[slot.serviceCode],
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                unitPriceCents: slot.unitPriceCents,
                subtotalCents: slot.subtotalCents,
              })),
            },
            statusChanges: { create: { toStatus: status, changedById: ownerId } },
          },
        });
        await tx.bookingVetInstruction.createMany({
          data: vetInstructionsFor(plan).map((attachment) => ({
            bookingId: created.id,
            ...attachment,
          })),
        });
        return created;
      });
    } catch (error) {
      // Another booking took the time between the check and the write.
      if (isSlotOverlap(error)) {
        throw slotTaken();
      }
      throw error;
    }
    await this.deadlines.schedule(booking);
    return this.get(ownerId, booking.id);
  }

  /** The owner's bookings, the latest service first. */
  async list(ownerId: string): Promise<BookingResponse[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { ownerId },
      include: BOOKING_INCLUDE,
      orderBy: { startsAt: 'desc' },
    });
    return Promise.all(bookings.map((booking) => this.toResponse(booking)));
  }

  async get(ownerId: string, bookingId: string): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, ownerId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw bookingNotFound();
    }
    return this.toResponse(booking);
  }

  /**
   * RN-CAN-07: the owner cancels at no cost while the booking is requested or waiting for payment.
   * Cancelling a confirmed booking (§10) comes after the demo.
   */
  async cancel(ownerId: string, bookingId: string, reason?: string): Promise<BookingResponse> {
    const booking = await this.findOwn({ id: bookingId, ownerId });
    if (!canTransition(booking.status, BookingStatus.CANCELLED_BY_OWNER)) {
      throw new ConflictException({
        errorCode: 'BOOKING_NOT_CANCELLABLE',
        message: 'Solo se puede cancelar una reserva antes de pagarla.',
        details: { status: booking.status },
      });
    }
    await this.stateMachine.transition(bookingId, {
      from: booking.status,
      to: BookingStatus.CANCELLED_BY_OWNER,
      changedById: ownerId,
      reason,
    });
    return this.get(ownerId, bookingId);
  }

  /**
   * The caregiver accepts a request, which then waits for payment (§8.2, RN-RES-07).
   * Nothing calls it over HTTP until the caregiver panel exists (after the demo).
   */
  async accept(caregiverId: string, bookingId: string): Promise<Booking> {
    const booking = await this.findOwn({ id: bookingId, caregiverId });
    const window = await this.settings.get('bookings.paymentWindowMinutes');
    const accepted = await this.stateMachine.transition(bookingId, {
      from: BookingStatus.REQUESTED,
      to: BookingStatus.PENDING_PAYMENT,
      changedById: caregiverId,
      paymentDueAt: paymentDeadline(this.clock.now(), booking.startsAt, window),
    });
    await this.deadlines.schedule(accepted);
    return accepted;
  }

  /** The caregiver rejects a request (§8.2), which frees the time. Like accept(), no route yet. */
  async reject(caregiverId: string, bookingId: string, reason?: string): Promise<Booking> {
    await this.findOwn({ id: bookingId, caregiverId });
    return this.stateMachine.transition(bookingId, {
      from: BookingStatus.REQUESTED,
      to: BookingStatus.REJECTED,
      changedById: caregiverId,
      reason,
    });
  }

  private async findOwn(where: { id: string; ownerId?: string; caregiverId?: string }) {
    const booking = await this.prisma.booking.findFirst({ where });
    if (!booking) {
      throw bookingNotFound();
    }
    return booking;
  }

  /** The ID of each service, which the seed loads. */
  private async serviceIds(): Promise<Record<ServiceCode, string>> {
    const services = await this.prisma.service.findMany({ select: { id: true, code: true } });
    return Object.fromEntries(services.map(({ code, id }) => [code, id])) as Record<
      ServiceCode,
      string
    >;
  }

  private async toResponse(booking: BookingWithDetails): Promise<BookingResponse> {
    const { caregiver, district } = booking;
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
      caregiver: {
        id: caregiver.userId,
        displayName: caregiverDisplayName(caregiver.user),
        photoUrl: await this.files.downloadUrl(caregiver.photoFile),
        phone: revealsContact(booking.status) ? caregiver.user.phone : null,
      },
      pets: booking.pets
        .map(({ pet, careLevel, vetInstructions }) => ({
          id: pet.id,
          name: pet.name,
          careLevel,
          vetInstructionIds: vetInstructions.map(({ vetInstructionId }) => vetInstructionId),
        }))
        .toSorted((a, b) => a.name.localeCompare(b.name, 'es')),
      slots: booking.slots.map((slot) => ({
        serviceCode: slot.service.code,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        unitPriceCents: slot.unitPriceCents,
        subtotalCents: slot.subtotalCents,
      })),
      address: {
        street: booking.addressStreet,
        details: booking.addressDetails,
        district: { id: district.id, slug: district.slug, name: district.name },
      },
      instructions: booking.instructions,
      emergency: {
        contactName: booking.emergencyContactName,
        contactPhone: booking.emergencyContactPhone,
        vetName: booking.emergencyVetName,
        vetPhone: booking.emergencyVetPhone,
        preauthorizedCents: booking.emergencyPreauthorizedCents,
        clinicConsent: booking.emergencyClinicConsent,
      },
      price: {
        subtotalCents: booking.subtotalCents,
        serviceFeeBp: booking.ownerServiceFeeBp,
        serviceFeeCents: booking.ownerServiceFeeCents,
        totalCents: booking.totalCents,
      },
      payment: currentPayment(booking.payments),
      createdAt: booking.createdAt.toISOString(),
    };
  }
}

/**
 * RN-RES-03: the vet instructions behind the clinical tasks active on the booking's
 * dates, once each.
 */
function vetInstructionsFor({ pets, dates }: BookingPlan) {
  return pets.flatMap((pet) => [
    ...new Map(
      activeOn(pet.careNeeds, dates.from, dates.to)
        .filter(({ task }) => CARE_TASK_GROUPS[task] === 'CLINICAL')
        .flatMap(({ vetInstructionId }) =>
          vetInstructionId
            ? [[vetInstructionId, { vetInstructionId, petId: pet.id }] as const]
            : [],
        ),
    ).values(),
  ]);
}
