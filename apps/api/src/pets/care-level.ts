import { CareLevel, type CareTask } from '../generated/prisma/enums.js';
import { CARE_TASK_GROUPS } from './care-tasks.js';

export interface DatedCareNeed {
  task: CareTask;
  startsOn: Date;
  /** Inclusive. Null means it has no end yet. */
  endsOn: Date | null;
}

export interface PetCareLevel {
  /** RN-MAS-04 to RN-MAS-06: SPECIAL if a clinical or assistance task is active. */
  careLevel: CareLevel;
  /** The clinical and assistance tasks active on those dates. */
  specialTasks: CareTask[];
  /** RN-MAS-09: tasks no caregiver may do. While any is active, the pet can't be booked. */
  prohibitedTasks: CareTask[];
}

/**
 * A pet's care level for a service between two dates, both inclusive (RN-MAS-05): a
 * task counts if its dates overlap them. Age alone never makes a pet Special
 * (RN-MAS-07), so only the care needs matter.
 */
export function careLevelOn(needs: readonly DatedCareNeed[], from: Date, to: Date): PetCareLevel {
  const active = needs.filter(
    ({ startsOn, endsOn }) => startsOn <= to && (endsOn === null || endsOn >= from),
  );
  const tasksOf = (prohibited: boolean) => [
    ...new Set(
      active
        .map(({ task }) => task)
        .filter((task) => (CARE_TASK_GROUPS[task] === 'PROHIBITED') === prohibited),
    ),
  ];
  const specialTasks = tasksOf(false);
  return {
    careLevel: specialTasks.length > 0 ? CareLevel.SPECIAL : CareLevel.STANDARD,
    specialTasks,
    prohibitedTasks: tasksOf(true),
  };
}
