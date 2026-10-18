import { randomUUID } from 'node:crypto';
import { blocksCalendar } from '../src/bookings/booking-status.js';
import {
  BookingStatus,
  CareLevel,
  CaregiverStatus,
  type PrismaClient,
  Role,
  ServiceCode,
} from '../src/generated/prisma/client.js';

// Minimal valid rows for the database tests. Every call creates new rows with unique
// values, so tests in the same database don't depend on each other.

export interface Catalog {
  districtId: string;
  speciesId: string;
  homeVisitId: string;
  overnightStayId: string;
}

export async function createCatalog(prisma: PrismaClient): Promise<Catalog> {
  const suffix = randomUUID();
  const district = await prisma.district.create({
    data: { slug: `district-${suffix}`, name: `Distrito ${suffix}` },
  });
  const species = await prisma.species.create({
    data: { code: `SPECIES_${suffix}`, name: 'Perro' },
  });
  const [homeVisit, overnightStay] = await Promise.all(
    [ServiceCode.HOME_VISIT, ServiceCode.OVERNIGHT_STAY].map((code) =>
      prisma.service.upsert({
        where: { code },
        create: { code, name: code, description: code },
        update: {},
      }),
    ),
  );
  return {
    districtId: district.id,
    speciesId: species.id,
    homeVisitId: homeVisit.id,
    overnightStayId: overnightStay.id,
  };
}

export function createUser(prisma: PrismaClient, roles: Role[] = [Role.OWNER]) {
  return prisma.user.create({
    data: {
      email: `${randomUUID()}@example.com`,
      firstName: 'Ana',
      lastName: 'Prueba',
      birthDate: new Date('1990-05-20'),
      roles,
    },
  });
}

export async function createCaregiver(prisma: PrismaClient) {
  const user = await createUser(prisma, [Role.CAREGIVER]);
  return prisma.caregiverProfile.create({
    data: { userId: user.id, status: CaregiverStatus.APPROVED, isActive: true },
  });
}

export async function createPet(prisma: PrismaClient, catalog: Catalog) {
  const owner = await createUser(prisma);
  return prisma.pet.create({
    data: {
      ownerId: owner.id,
      speciesId: catalog.speciesId,
      name: 'Luna',
      birthDate: new Date('2015-03-01'),
      sex: 'FEMALE',
    },
  });
}

export async function createVetInstruction(
  prisma: PrismaClient,
  pet: { id: string; ownerId: string },
) {
  const file = await prisma.file.create({
    data: {
      uploadedById: pet.ownerId,
      purpose: 'VET_INSTRUCTION',
      storageKey: `vet-instructions/${randomUUID()}.pdf`,
      contentType: 'application/pdf',
    },
  });
  return prisma.vetInstruction.create({
    data: { petId: pet.id, fileId: file.id, issuedOn: new Date('2026-10-01') },
  });
}

export interface SlotTimes {
  startsAt: Date;
  endsAt: Date;
}

const UNIT_PRICE_CENTS = 1200;

/** A standard home visit booking with one owner and the given slots. */
export async function createBooking(
  prisma: PrismaClient,
  catalog: Catalog,
  {
    caregiverId,
    slots,
    status = BookingStatus.CONFIRMED,
  }: { caregiverId: string; slots: SlotTimes[]; status?: BookingStatus },
) {
  const owner = await createUser(prisma);
  const subtotalCents = UNIT_PRICE_CENTS * slots.length;
  const ownerServiceFeeCents = subtotalCents / 10;
  const caregiverCommissionCents = (subtotalCents * 15) / 100;
  const dueAt = new Date(slots[0].startsAt.getTime() - 60 * 60 * 1000);

  return prisma.booking.create({
    data: {
      ownerId: owner.id,
      caregiverId,
      serviceId: catalog.homeVisitId,
      careLevel: CareLevel.STANDARD,
      status,
      blocksCalendar: blocksCalendar(status),
      startsAt: slots[0].startsAt,
      endsAt: slots[slots.length - 1].endsAt,
      districtId: catalog.districtId,
      addressStreet: 'Calle La Mascota 12, Colonia Escalón',
      emergencyContactName: 'Luis Prueba',
      emergencyContactPhone: '+503 7000 0000',
      emergencyPreauthorizedCents: 5000,
      emergencyClinicConsent: true,
      responseDueAt: dueAt,
      paymentDueAt: dueAt,
      subtotalCents,
      ownerServiceFeeBp: 1000,
      ownerServiceFeeCents,
      totalCents: subtotalCents + ownerServiceFeeCents,
      caregiverCommissionBp: 1500,
      caregiverCommissionCents,
      caregiverPayoutCents: subtotalCents - caregiverCommissionCents,
      additionalPetSurchargeBp: 5000,
      guaranteeFundBp: 200,
      vatBp: 1300,
      gatewayFeeBp: 350,
      pricingSnapshot: {},
      slots: {
        create: slots.map(({ startsAt, endsAt }) => ({
          serviceId: catalog.homeVisitId,
          startsAt,
          endsAt,
          unitPriceCents: UNIT_PRICE_CENTS,
          subtotalCents: UNIT_PRICE_CENTS,
        })),
      },
    },
    include: { slots: true },
  });
}

/** Moves a booking to another status, keeping blocks_calendar in step. */
export function changeStatus(prisma: PrismaClient, bookingId: string, status: BookingStatus) {
  return prisma.booking.update({
    where: { id: bookingId },
    data: { status, blocksCalendar: blocksCalendar(status) },
    include: { slots: true },
  });
}

/** A time in El Salvador (UTC−6, no daylight saving time). */
export function svTime(dateTime: string): Date {
  return new Date(`${dateTime}-06:00`);
}
