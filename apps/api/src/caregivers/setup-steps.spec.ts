import { CaregiverStatus } from '../generated/prisma/enums.js';
import {
  pendingSetupSteps,
  REQUIRED_DOCUMENTS,
  type SetupState,
  visibleInSearch,
} from './setup-steps.js';

const NOW = new Date('2026-11-03T15:00:00Z');

/** A caregiver who did everything, so each test undoes one thing. */
const DONE: SetupState = {
  status: CaregiverStatus.APPROVED,
  documentKinds: REQUIRED_DOCUMENTS,
  welcomeCoursePassedAt: new Date('2026-11-01T15:00:00Z'),
  districtCount: 2,
  availabilityCount: 5,
  serviceCount: 1,
};
const VISIBLE = { ...DONE, isPaused: false, suspendedUntil: null };

describe('pendingSetupSteps', () => {
  it('lists every step, in order, for a profile just created (RN-CTA-06)', () => {
    expect(
      pendingSetupSteps({
        status: CaregiverStatus.PENDING_APPROVAL,
        documentKinds: [],
        welcomeCoursePassedAt: null,
        districtCount: 0,
        availabilityCount: 0,
        serviceCount: 2,
      }),
    ).toEqual(['DOCUMENTS', 'WELCOME_COURSE', 'APPROVAL', 'DISTRICTS', 'AVAILABILITY']);
  });

  it('asks for both sides of the DUI, the selfie and the background check (RN-CUI-01)', () => {
    expect(
      pendingSetupSteps({
        ...DONE,
        documentKinds: ['ID_DOCUMENT_FRONT', 'SELFIE', 'BACKGROUND_CHECK'],
      }),
    ).toEqual(['DOCUMENTS']);
  });

  it('needs the welcome course (RN-CUI-02) and the approval (RN-CUI-03) separately', () => {
    expect(pendingSetupSteps({ ...DONE, welcomeCoursePassedAt: null })).toEqual(['WELCOME_COURSE']);
    expect(pendingSetupSteps({ ...DONE, status: CaregiverStatus.PENDING_APPROVAL })).toEqual([
      'APPROVAL',
    ]);
  });

  it('needs at least one service offered (RN-CUI-17)', () => {
    expect(pendingSetupSteps({ ...DONE, serviceCount: 0 })).toEqual(['SERVICES']);
  });

  it('is empty when the sign-up is complete', () => {
    expect(pendingSetupSteps(DONE)).toEqual([]);
  });
});

describe('visibleInSearch (RN-CUI-03)', () => {
  it('shows a caregiver with nothing pending', () => {
    expect(visibleInSearch(VISIBLE, NOW)).toBe(true);
  });

  it('hides a paused caregiver (RN-CUI-20)', () => {
    expect(visibleInSearch({ ...VISIBLE, isPaused: true }, NOW)).toBe(false);
  });

  it('hides a suspended caregiver until the suspension ends (RN-CAN-05)', () => {
    expect(
      visibleInSearch({ ...VISIBLE, suspendedUntil: new Date('2026-11-04T00:00:00Z') }, NOW),
    ).toBe(false);
    expect(visibleInSearch({ ...VISIBLE, suspendedUntil: NOW }, NOW)).toBe(true);
  });

  it('hides a caregiver with a step pending', () => {
    expect(visibleInSearch({ ...VISIBLE, availabilityCount: 0 }, NOW)).toBe(false);
  });
});
