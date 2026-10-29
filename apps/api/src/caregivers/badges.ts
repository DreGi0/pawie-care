import { CaregiverStatus } from '../generated/prisma/enums.js';

/** RN-CUI-03, RN-CUI-05: badges derived from data that already exists, never stored. */
export const CaregiverBadge = {
  IDENTITY_VERIFIED: 'IDENTITY_VERIFIED',
  BACKGROUND_CHECKED: 'BACKGROUND_CHECKED',
  VET_STUDENT: 'VET_STUDENT',
} as const;
export type CaregiverBadge = (typeof CaregiverBadge)[keyof typeof CaregiverBadge];

/**
 * Approval verifies identity and background together (RN-CUI-03, RN-NIV-03); the vet
 * student badge lasts through `vetStudentUntil` (RN-CUI-05).
 */
export function badgesOf(
  caregiver: { status: CaregiverStatus; vetStudentUntil: Date | null },
  today: Date,
): CaregiverBadge[] {
  return [
    ...(caregiver.status === CaregiverStatus.APPROVED
      ? [CaregiverBadge.IDENTITY_VERIFIED, CaregiverBadge.BACKGROUND_CHECKED]
      : []),
    ...(caregiver.vetStudentUntil !== null && caregiver.vetStudentUntil >= today
      ? [CaregiverBadge.VET_STUDENT]
      : []),
  ];
}
