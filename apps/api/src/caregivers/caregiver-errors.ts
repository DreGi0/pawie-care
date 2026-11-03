import { NotFoundException } from '@nestjs/common';

/** The account hasn't turned on caregiver mode, so it has no caregiver profile (RN-CTA-06). */
export function caregiverProfileNotFound(): NotFoundException {
  return new NotFoundException({
    errorCode: 'CAREGIVER_PROFILE_NOT_FOUND',
    message: 'Primero activa el modo cuidador desde Cuenta.',
  });
}
