import { CareTask } from '../generated/prisma/enums.js';

/**
 * - CLINICAL: makes the pet Special and needs written vet instructions (RN-MAS-08).
 * - ASSISTANCE: makes the pet Special; the owner's written instructions are enough.
 * - PROHIBITED: no caregiver may do it (RN-CUI-13), so the pet can't be booked while
 *   it's active (RN-MAS-09).
 */
export type CareTaskGroup = 'CLINICAL' | 'ASSISTANCE' | 'PROHIBITED';

/**
 * Group of each care task (RN-MAS-06, RN-CUI-12, RN-CUI-13). The CHECK constraints on
 * pet_care_needs repeat these lists, so change both together; a test compares them.
 */
export const CARE_TASK_GROUPS: Readonly<Record<CareTask, CareTaskGroup>> = {
  [CareTask.MEDICATION]: 'CLINICAL',
  [CareTask.WOUND_CARE]: 'CLINICAL',
  [CareTask.POST_OPERATIVE_RECOVERY]: 'CLINICAL',
  [CareTask.SYRINGE_FEEDING]: 'CLINICAL',
  [CareTask.PRESCRIBED_REST]: 'CLINICAL',
  [CareTask.CHRONIC_CONDITION_MONITORING]: 'CLINICAL',
  [CareTask.MOBILITY_ASSISTANCE]: 'ASSISTANCE',
  [CareTask.INCONTINENCE_HYGIENE]: 'ASSISTANCE',
  [CareTask.INJECTION]: 'PROHIBITED',
  [CareTask.IV_FLUIDS]: 'PROHIBITED',
  [CareTask.STITCH_OR_DRAIN_REMOVAL]: 'PROHIBITED',
  [CareTask.TUBE_PLACEMENT]: 'PROHIBITED',
  [CareTask.SEDATION]: 'PROHIBITED',
  [CareTask.DOSE_CHANGE]: 'PROHIBITED',
  [CareTask.DIAGNOSIS_OR_PRESCRIPTION]: 'PROHIBITED',
};

/** Whether a care need for the task can have no end date (RN-MAS-08). */
export function canBeOpenEnded(task: CareTask): boolean {
  return (
    task === CareTask.CHRONIC_CONDITION_MONITORING ||
    task === CareTask.MOBILITY_ASSISTANCE ||
    CARE_TASK_GROUPS[task] === 'PROHIBITED'
  );
}
