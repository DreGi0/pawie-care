import {
  BookingStatus,
  CareTask,
  CertificationStatus,
  PaymentProvider,
  PaymentStatus,
  type Pet,
  type PrismaClient,
  type VetInstruction,
} from '../../src/generated/prisma/client.js';
import { CARE_TASK_GROUPS, canBeOpenEnded } from '../../src/pets/care-tasks.js';
import { createTestDatabase, type TestDatabase } from '../database.js';
import {
  type Catalog,
  createBooking,
  createCaregiver,
  createCatalog,
  createPet,
  createUser,
  createVetInstruction,
  svTime,
} from '../factories.js';

// CHECK constraints and partial unique indexes from the hand-written migration
// prisma/migrations/20261017233100_constraints.
describe('database constraints', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let catalog: Catalog;

  beforeAll(async () => {
    db = await createTestDatabase();
    prisma = db.prisma;
    catalog = await createCatalog(prisma);
  });

  afterAll(async () => {
    await db.close();
  });

  const UNIQUE_VIOLATION = { code: 'P2002' };
  const ALL_TASKS = Object.values(CareTask);

  // RN-MAS-06, RN-MAS-08, RN-CUI-12, RN-CUI-13
  describe('pet care needs', () => {
    let pet: Pet;
    let vetInstruction: VetInstruction;

    beforeAll(async () => {
      pet = await createPet(prisma, catalog);
      vetInstruction = await createVetInstruction(prisma, pet);
    });

    function createNeed(
      task: CareTask,
      data: { vetInstructionId?: string; ownerInstructions?: string; endsOn?: Date | null } = {},
    ) {
      return prisma.petCareNeed.create({
        data: {
          petId: pet.id,
          task,
          startsOn: new Date('2026-11-01'),
          endsOn: new Date('2026-11-15'),
          ...data,
        },
      });
    }

    it('requires vet instructions for clinical tasks', async () => {
      await expect(
        createNeed(CareTask.MEDICATION, { ownerInstructions: 'Media pastilla cada 12 h' }),
      ).rejects.toThrow(/pet_care_needs_vet_instruction_check/);
      await expect(
        createNeed(CareTask.MEDICATION, { vetInstructionId: vetInstruction.id }),
      ).resolves.toBeDefined();
    });

    it('requires the owner instructions for assistance tasks', async () => {
      await expect(createNeed(CareTask.MOBILITY_ASSISTANCE)).rejects.toThrow(
        /pet_care_needs_owner_instructions_check/,
      );
      await expect(
        createNeed(CareTask.INCONTINENCE_HYGIENE, { ownerInstructions: '   ' }),
      ).rejects.toThrow(/pet_care_needs_owner_instructions_check/);
      await expect(
        createNeed(CareTask.MOBILITY_ASSISTANCE, {
          ownerInstructions: 'Levantarla con el arnés para salir al patio',
        }),
      ).resolves.toBeDefined();
    });

    it('requires no instructions for prohibited tasks', async () => {
      await expect(createNeed(CareTask.INJECTION, { endsOn: null })).resolves.toBeDefined();
    });

    /** The tasks for which creating the need, as `data` describes it, fails. */
    async function rejectedTasks(data: Parameters<typeof createNeed>[1]): Promise<CareTask[]> {
      const rejected: CareTask[] = [];
      for (const task of ALL_TASKS) {
        if (
          await createNeed(task, data).then(
            () => false,
            () => true,
          )
        ) {
          rejected.push(task);
        }
      }
      return rejected;
    }

    it('matches the groups in care-tasks.ts', async () => {
      const inGroup = (group: string) =>
        ALL_TASKS.filter((task) => CARE_TASK_GROUPS[task] === group);

      expect(await rejectedTasks({ ownerInstructions: 'Instrucciones del dueño' })).toEqual(
        inGroup('CLINICAL'),
      );
      expect(await rejectedTasks({ vetInstructionId: vetInstruction.id })).toEqual(
        inGroup('ASSISTANCE'),
      );
    });

    it('lets only chronic monitoring, mobility help and prohibited tasks be open-ended', async () => {
      const closedOnly = await rejectedTasks({
        vetInstructionId: vetInstruction.id,
        ownerInstructions: 'Instrucciones del dueño',
        endsOn: null,
      });
      const openEnded = ALL_TASKS.filter((task) => !closedOnly.includes(task));

      expect(openEnded).toEqual(ALL_TASKS.filter(canBeOpenEnded));
      expect(openEnded).toEqual(
        expect.arrayContaining([
          CareTask.CHRONIC_CONDITION_MONITORING,
          CareTask.MOBILITY_ASSISTANCE,
          CareTask.INJECTION,
        ]),
      );
      expect(openEnded).not.toContain(CareTask.INCONTINENCE_HYGIENE);
    });

    it('rejects an end date before the start date', async () => {
      await expect(
        createNeed(CareTask.SEDATION, { endsOn: new Date('2026-10-31') }),
      ).rejects.toThrow(/pet_care_needs_dates_check/);
    });

    it("rejects another pet's vet instructions", async () => {
      const otherPet = await createPet(prisma, catalog);
      const otherInstruction = await createVetInstruction(prisma, otherPet);

      await expect(
        createNeed(CareTask.WOUND_CARE, { vetInstructionId: otherInstruction.id }),
      ).rejects.toThrow(/pet_care_needs_vet_instruction_id_pet_id_fkey/);
    });
  });

  // RN-CUI-11
  describe('caregiver certifications', () => {
    async function certify(caregiverId: string, status: CertificationStatus) {
      const type = await prisma.certificationType.upsert({
        where: { code: 'SPECIAL_CARE' },
        create: { code: 'SPECIAL_CARE', name: 'Cuidado especial' },
        update: {},
      });
      return prisma.caregiverCertification.create({
        data: {
          caregiverId,
          certificationTypeId: type.id,
          status,
          obtainedOn: new Date('2026-01-10'),
          validUntil: new Date('2027-01-09'),
          revokedAt: status === CertificationStatus.REVOKED ? new Date() : null,
        },
      });
    }

    it('allows only one active certification per type', async () => {
      const { userId } = await createCaregiver(prisma);
      await certify(userId, CertificationStatus.ACTIVE);

      await expect(certify(userId, CertificationStatus.ACTIVE)).rejects.toMatchObject(
        UNIQUE_VIOLATION,
      );
    });

    it('keeps past certifications next to the active one', async () => {
      const { userId } = await createCaregiver(prisma);
      await certify(userId, CertificationStatus.EXPIRED);
      await certify(userId, CertificationStatus.REVOKED);

      await expect(certify(userId, CertificationStatus.ACTIVE)).resolves.toBeDefined();
    });

    it('requires revoked_at exactly when revoked', async () => {
      const { userId } = await createCaregiver(prisma);
      const certification = await certify(userId, CertificationStatus.ACTIVE);

      await expect(
        prisma.caregiverCertification.update({
          where: { id: certification.id },
          data: { status: CertificationStatus.REVOKED },
        }),
      ).rejects.toThrow(/caregiver_certifications_revoked_at_check/);
    });
  });

  // RN-PAG-02
  describe('payments', () => {
    async function pay(bookingId: string, status: PaymentStatus) {
      return prisma.payment.create({
        data: {
          bookingId,
          provider: PaymentProvider.WOMPI,
          status,
          amountCents: 1320,
          approvedAt:
            status === PaymentStatus.APPROVED || status === PaymentStatus.REFUND_PENDING
              ? new Date()
              : null,
        },
      });
    }

    async function confirmedBooking() {
      const caregiver = await createCaregiver(prisma);
      return createBooking(prisma, catalog, {
        caregiverId: caregiver.userId,
        slots: [{ startsAt: svTime('2026-11-03T08:00'), endsAt: svTime('2026-11-03T09:00') }],
      });
    }

    it('allows only one approved payment per booking', async () => {
      const booking = await confirmedBooking();
      await pay(booking.id, PaymentStatus.DECLINED);
      await pay(booking.id, PaymentStatus.DECLINED);
      await pay(booking.id, PaymentStatus.APPROVED);

      await expect(pay(booking.id, PaymentStatus.APPROVED)).rejects.toMatchObject(UNIQUE_VIOLATION);
      await expect(pay(booking.id, PaymentStatus.REFUND_PENDING)).resolves.toBeDefined();
    });

    it('requires approved_at exactly for the approved statuses', async () => {
      const booking = await confirmedBooking();
      const payment = await pay(booking.id, PaymentStatus.PENDING);

      await expect(
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.APPROVED },
        }),
      ).rejects.toThrow(/payments_approved_at_check/);
    });

    it('records each webhook once per provider', async () => {
      const event = { provider: PaymentProvider.WOMPI, externalId: 'tx-123', payload: {} };
      await prisma.webhookEvent.create({ data: event });

      await expect(prisma.webhookEvent.create({ data: event })).rejects.toMatchObject(
        UNIQUE_VIOLATION,
      );
    });
  });

  describe('bookings', () => {
    it('requires a response deadline while requested (RN-RES-06)', async () => {
      const caregiver = await createCaregiver(prisma);
      const booking = await createBooking(prisma, catalog, {
        caregiverId: caregiver.userId,
        slots: [{ startsAt: svTime('2026-11-04T08:00'), endsAt: svTime('2026-11-04T09:00') }],
        status: BookingStatus.REQUESTED,
      });

      await expect(
        prisma.booking.update({ where: { id: booking.id }, data: { responseDueAt: null } }),
      ).rejects.toThrow(/bookings_response_due_at_check/);
    });

    it('keeps the copied amounts consistent (RN-PRE-03, RN-PRE-04)', async () => {
      const caregiver = await createCaregiver(prisma);
      const booking = await createBooking(prisma, catalog, {
        caregiverId: caregiver.userId,
        slots: [{ startsAt: svTime('2026-11-05T08:00'), endsAt: svTime('2026-11-05T09:00') }],
      });

      await expect(
        prisma.booking.update({
          where: { id: booking.id },
          data: { totalCents: booking.totalCents + 1 },
        }),
      ).rejects.toThrow(/bookings_amounts_check/);
      await expect(
        prisma.booking.update({
          where: { id: booking.id },
          data: { caregiverPayoutCents: booking.subtotalCents },
        }),
      ).rejects.toThrow(/bookings_amounts_check/);
    });
  });

  describe('caregivers', () => {
    it('stores a weekly window that crosses midnight as one row', async () => {
      const { userId } = await createCaregiver(prisma);
      const window = (startMinute: number, endMinute: number, weekday = 1) =>
        prisma.caregiverAvailability.create({
          data: { caregiverId: userId, weekday, startMinute, endMinute },
        });

      // Monday 19:00 to Tuesday 08:00.
      await expect(window(19 * 60, 32 * 60)).resolves.toBeDefined();
      await expect(window(8 * 60, 8 * 60 + 24 * 60 + 1)).rejects.toThrow(
        /caregiver_availability_window_check/,
      );
      await expect(window(10 * 60, 9 * 60)).rejects.toThrow(/caregiver_availability_window_check/);
      await expect(window(8 * 60, 9 * 60, 0)).rejects.toThrow(
        /caregiver_availability_weekday_check/,
      );
    });

    it('keeps rating sums within 1 to 5 stars per rating', async () => {
      const { userId } = await createCaregiver(prisma);
      const rate = (data: { ratingCount: number; ratingSum: number }) =>
        prisma.caregiverProfile.update({ where: { userId }, data });

      await expect(rate({ ratingCount: 4, ratingSum: 19 })).resolves.toBeDefined();
      await expect(rate({ ratingCount: 4, ratingSum: 21 })).rejects.toThrow(
        /caregiver_profiles_ratings_check/,
      );
      await expect(rate({ ratingCount: 4, ratingSum: 3 })).rejects.toThrow(
        /caregiver_profiles_ratings_check/,
      );
    });
  });

  describe('users', () => {
    it('stores emails normalized, so the unique index ignores case', async () => {
      const user = await createUser(prisma);

      await expect(
        prisma.user.update({ where: { id: user.id }, data: { email: user.email.toUpperCase() } }),
      ).rejects.toThrow(/users_email_check/);
      await expect(
        prisma.user.update({ where: { id: user.id }, data: { email: ` ${user.email}` } }),
      ).rejects.toThrow(/users_email_check/);
    });

    it('requires at least one role (RN-CTA-01)', async () => {
      await expect(createUser(prisma, [])).rejects.toThrow(/users_roles_check/);
    });
  });
});
