import { CertificationStatus, type Prisma } from '../generated/prisma/client.js';

/**
 * A certification that counts through `lastDate`: active, valid that day and not
 * suspended (RN-CUI-09, RN-CUI-10). The caller adds the type, if it needs one.
 */
export function validCertification(lastDate: Date, now: Date) {
  return {
    status: CertificationStatus.ACTIVE,
    validUntil: { gte: lastDate },
    OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }],
  } satisfies Prisma.CaregiverCertificationWhereInput;
}
