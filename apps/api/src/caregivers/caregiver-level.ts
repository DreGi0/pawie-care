import { CaregiverLevel } from '../generated/prisma/enums.js';
import type { SettingValue } from '../settings/settings.registry.js';

type LevelRequirements = SettingValue<'levels.requirements'>;

/** Above NEW, from the lowest. NEW asks for nothing (RN-NIV-02). */
const UPPER_LEVELS = [CaregiverLevel.TRUSTED, CaregiverLevel.PRO, CaregiverLevel.SUPER] as const;
export const RANKED_LEVELS = [CaregiverLevel.NEW, ...UPPER_LEVELS] as const;

/** What the level of a caregiver depends on (RN-NIV-02). */
export interface LevelInput {
  ratingCount: number;
  /** Sum of the stars, so the average never drifts. */
  ratingSum: number;
  completedBookingCount: number;
  /** Codes of the certifications that are valid today: active, not expired, not suspended. */
  certificationCodes: readonly string[];
}

/**
 * One requirement of a level and whether the caregiver meets it (RN-NIV-05). Only what
 * the level asks for: a threshold of 0 isn't a requirement.
 */
export type LevelRequirement = { met: boolean } & (
  | {
      kind: 'reviews' | 'averageRatingTenths' | 'completedBookings' | 'certifications';
      /** The caregiver's figure. The average is in tenths of a star, rounded down. */
      current: number;
      required: number;
    }
  | { kind: 'certification'; code: string }
);

export interface CaregiverLevelResult {
  level: CaregiverLevel;
  /** The next level and each of its requirements, met or not. Null at the top. */
  next: { level: CaregiverLevel; requirements: LevelRequirement[] } | null;
}

/**
 * RN-NIV-01, RN-NIV-02: the highest level whose requirements the caregiver meets, and
 * what they lack for the one after. It is computed from the data every time, so the
 * level goes down when the data does (RN-NIV-04).
 */
export function caregiverLevel(
  input: LevelInput,
  requirements: LevelRequirements,
): CaregiverLevelResult {
  const requirementsOf = (level: (typeof UPPER_LEVELS)[number]) =>
    levelRequirements(input, requirements[level]);

  const level =
    UPPER_LEVELS.findLast((level) => requirementsOf(level).every(({ met }) => met)) ??
    CaregiverLevel.NEW;
  const nextLevel = RANKED_LEVELS[RANKED_LEVELS.indexOf(level) + 1] as
    (typeof UPPER_LEVELS)[number] | undefined;
  return {
    level,
    next: nextLevel ? { level: nextLevel, requirements: requirementsOf(nextLevel) } : null,
  };
}

function levelRequirements(
  { ratingCount, ratingSum, completedBookingCount, certificationCodes }: LevelInput,
  requirement: LevelRequirements[(typeof UPPER_LEVELS)[number]],
): LevelRequirement[] {
  const held = new Set(certificationCodes);
  const requirements: LevelRequirement[] = [
    {
      kind: 'reviews',
      current: ratingCount,
      required: requirement.minReviews,
      met: ratingCount >= requirement.minReviews,
    },
    {
      kind: 'averageRatingTenths',
      current: ratingCount === 0 ? 0 : Math.floor((ratingSum * 10) / ratingCount),
      required: requirement.minAverageRatingTenths,
      // sum / count ≥ tenths / 10, without dividing: integers compare exactly.
      met: ratingCount > 0 && ratingSum * 10 >= requirement.minAverageRatingTenths * ratingCount,
    },
  ];
  if (requirement.minCompletedBookings > 0) {
    requirements.push({
      kind: 'completedBookings',
      current: completedBookingCount,
      required: requirement.minCompletedBookings,
      met: completedBookingCount >= requirement.minCompletedBookings,
    });
  }
  if (requirement.minCertifications > 0) {
    requirements.push({
      kind: 'certifications',
      current: held.size,
      required: requirement.minCertifications,
      met: held.size >= requirement.minCertifications,
    });
  }
  for (const code of requirement.requiredCertificationCodes) {
    requirements.push({ kind: 'certification', code, met: held.has(code) });
  }
  return requirements;
}
