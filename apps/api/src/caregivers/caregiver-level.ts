import { CaregiverLevel } from '../generated/prisma/enums.js';
import type { SettingValue } from '../settings/settings.registry.js';

type LevelRequirements = SettingValue<'levels.requirements'>;

/** Above NEW, from the lowest. NEW asks for nothing (RN-NIV-02). */
const UPPER_LEVELS = [CaregiverLevel.TRUSTED, CaregiverLevel.PRO, CaregiverLevel.SUPER] as const;
const RANKED_LEVELS = [CaregiverLevel.NEW, ...UPPER_LEVELS] as const;

/** What the level of a caregiver depends on (RN-NIV-02). */
export interface LevelInput {
  ratingCount: number;
  /** Sum of the stars, so the average never drifts. */
  ratingSum: number;
  completedBookingCount: number;
  /** Codes of the certifications that are valid today: active, not expired, not suspended. */
  certificationCodes: readonly string[];
}

/** A requirement the caregiver doesn't meet yet, requirement by requirement (RN-NIV-05). */
export type MissingRequirement =
  | {
      kind: 'reviews' | 'averageRatingTenths' | 'completedBookings' | 'certifications';
      /** The caregiver's figure. The average is in tenths of a star, rounded down. */
      current: number;
      required: number;
    }
  | { kind: 'certification'; code: string };

export interface CaregiverLevelResult {
  level: CaregiverLevel;
  /** What is missing for the next level. Null at the top. */
  next: { level: CaregiverLevel; missing: MissingRequirement[] } | null;
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
  const missingFor = (level: (typeof UPPER_LEVELS)[number]) =>
    missingRequirements(input, requirements[level]);

  const level =
    UPPER_LEVELS.findLast((level) => missingFor(level).length === 0) ?? CaregiverLevel.NEW;
  const nextLevel = RANKED_LEVELS[RANKED_LEVELS.indexOf(level) + 1] as
    (typeof UPPER_LEVELS)[number] | undefined;
  return {
    level,
    next: nextLevel ? { level: nextLevel, missing: missingFor(nextLevel) } : null,
  };
}

function missingRequirements(
  { ratingCount, ratingSum, completedBookingCount, certificationCodes }: LevelInput,
  requirement: LevelRequirements[(typeof UPPER_LEVELS)[number]],
): MissingRequirement[] {
  const held = new Set(certificationCodes);
  const missing: MissingRequirement[] = [];

  if (ratingCount < requirement.minReviews) {
    missing.push({ kind: 'reviews', current: ratingCount, required: requirement.minReviews });
  }
  // sum / count ≥ tenths / 10, without dividing: integers compare exactly.
  if (ratingCount === 0 || ratingSum * 10 < requirement.minAverageRatingTenths * ratingCount) {
    missing.push({
      kind: 'averageRatingTenths',
      current: ratingCount === 0 ? 0 : Math.floor((ratingSum * 10) / ratingCount),
      required: requirement.minAverageRatingTenths,
    });
  }
  if (completedBookingCount < requirement.minCompletedBookings) {
    missing.push({
      kind: 'completedBookings',
      current: completedBookingCount,
      required: requirement.minCompletedBookings,
    });
  }
  if (held.size < requirement.minCertifications) {
    missing.push({
      kind: 'certifications',
      current: held.size,
      required: requirement.minCertifications,
    });
  }
  for (const code of requirement.requiredCertificationCodes) {
    if (!held.has(code)) {
      missing.push({ kind: 'certification', code });
    }
  }
  return missing;
}
