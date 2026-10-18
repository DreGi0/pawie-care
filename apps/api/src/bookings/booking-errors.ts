import { ConflictException } from '@nestjs/common';

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
