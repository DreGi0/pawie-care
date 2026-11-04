import { CaregiverDocumentKind, CaregiverStatus, FilePurpose } from '../generated/prisma/enums.js';

/**
 * RN-CUI-01: every document of the sign-up, both sides of the DUI included, and the
 * purpose its file is uploaded with. Provisional: [DEFINIR: documentos exactos con el
 * abogado].
 */
export const DOCUMENT_FILE_PURPOSES: Readonly<Record<CaregiverDocumentKind, FilePurpose>> = {
  [CaregiverDocumentKind.ID_DOCUMENT_FRONT]: FilePurpose.ID_DOCUMENT,
  [CaregiverDocumentKind.ID_DOCUMENT_BACK]: FilePurpose.ID_DOCUMENT,
  [CaregiverDocumentKind.SELFIE]: FilePurpose.SELFIE,
  [CaregiverDocumentKind.BACKGROUND_CHECK]: FilePurpose.BACKGROUND_CHECK,
};

export const REQUIRED_DOCUMENTS = Object.keys(DOCUMENT_FILE_PURPOSES) as CaregiverDocumentKind[];

/** What a caregiver has to do to show up in searches, in the order the app asks for it. */
export const CaregiverSetupStep = {
  /** RN-CUI-01 */
  DOCUMENTS: 'DOCUMENTS',
  /** RN-CUI-02 */
  WELCOME_COURSE: 'WELCOME_COURSE',
  /** RN-CUI-03: an admin approves the sign-up. */
  APPROVAL: 'APPROVAL',
  /** RN-CUI-04 */
  DISTRICTS: 'DISTRICTS',
  /** RN-CUI-04 */
  AVAILABILITY: 'AVAILABILITY',
  /** RN-CUI-17: at least one service offered. */
  SERVICES: 'SERVICES',
} as const;
export type CaregiverSetupStep = (typeof CaregiverSetupStep)[keyof typeof CaregiverSetupStep];

export interface SetupState {
  status: CaregiverStatus;
  documentKinds: readonly CaregiverDocumentKind[];
  welcomeCoursePassedAt: Date | null;
  districtCount: number;
  availabilityCount: number;
  serviceCount: number;
}

/** The steps the caregiver hasn't done, in order. Empty when the sign-up is complete. */
export function pendingSetupSteps(state: SetupState): CaregiverSetupStep[] {
  const done: Record<CaregiverSetupStep, boolean> = {
    DOCUMENTS: REQUIRED_DOCUMENTS.every((kind) => state.documentKinds.includes(kind)),
    WELCOME_COURSE: state.welcomeCoursePassedAt !== null,
    APPROVAL: state.status === CaregiverStatus.APPROVED,
    DISTRICTS: state.districtCount > 0,
    AVAILABILITY: state.availabilityCount > 0,
    SERVICES: state.serviceCount > 0,
  };
  return Object.values(CaregiverSetupStep).filter((step) => !done[step]);
}

/**
 * Whether searches can show the caregiver (RN-CUI-03, RN-CUI-20, RN-CAN-05): nothing
 * pending, not paused and not suspended. Each search still needs the district, the
 * service and the schedule to match.
 */
export function visibleInSearch(
  state: SetupState & { isPaused: boolean; suspendedUntil: Date | null },
  now: Date,
): boolean {
  return (
    pendingSetupSteps(state).length === 0 &&
    !state.isPaused &&
    (state.suspendedUntil === null || state.suspendedUntil <= now)
  );
}
