import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/** PostgreSQL's exclusion_violation: only booking_slots_no_overlap raises it. */
const EXCLUSION_VIOLATION = '23P01';

/** Whether a write failed because two blocking slots of a caregiver would overlap. */
export function isSlotOverlap(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  // With a driver adapter, Prisma puts PostgreSQL's own code here.
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  return adapterError?.cause?.originalCode === EXCLUSION_VIOLATION;
}

/**
 * RN-CUI-15: another booking holds the caregiver's time, whether the API saw it
 * before writing or the exclusion constraint booking_slots_no_overlap stopped two
 * bookings made at the same time.
 */
export function slotTaken(): ConflictException {
  return new ConflictException({
    errorCode: 'SLOT_TAKEN',
    message:
      'Alguien acaba de reservar ese horario con este cuidador. Elige otro horario o cuidador.',
  });
}
