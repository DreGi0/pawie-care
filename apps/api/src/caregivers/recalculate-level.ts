import { dateInElSalvador } from '../common/time/calendar.js';
import type { CaregiverLevel, Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { SettingsService } from '../settings/settings.service.js';
import { caregiverLevel } from './caregiver-level.js';
import { validCertification } from './certifications.js';

type Requirements = Parameters<typeof caregiverLevel>[1];

/**
 * RN-NIV-04: recomputes the caregiver's stored level from their ratings, completed
 * services and valid certifications. Call it in the same transaction that changes any
 * of them, after the change, with the requirements read from `levels.requirements`.
 * It locks the profile so two transactions can't leave the older figures as the level.
 * Returns the level the caregiver has now.
 */
export async function recalculateLevel(
  tx: Prisma.TransactionClient,
  caregiverId: string,
  requirements: Requirements,
  now: Date = new Date(),
): Promise<CaregiverLevel> {
  await tx.$queryRaw`SELECT 1 FROM caregiver_profiles WHERE user_id = ${caregiverId}::uuid FOR UPDATE`;
  const profile = await tx.caregiverProfile.findUniqueOrThrow({
    where: { userId: caregiverId },
    select: {
      level: true,
      ratingCount: true,
      ratingSum: true,
      completedBookingCount: true,
      certifications: {
        where: validCertification(dateInElSalvador(now), now),
        select: { certificationType: { select: { code: true } } },
      },
    },
  });

  const { level } = caregiverLevel(
    {
      ...profile,
      certificationCodes: profile.certifications.map(
        ({ certificationType }) => certificationType.code,
      ),
    },
    requirements,
  );
  if (level !== profile.level) {
    await tx.caregiverProfile.update({ where: { userId: caregiverId }, data: { level } });
  }
  return level;
}

export interface LevelChange {
  caregiverId: string;
  from: CaregiverLevel;
  to: CaregiverLevel;
}

/**
 * Recalculates every caregiver, one transaction each. For after the requirements
 * change, and because a certification expiring changes a level with nothing to
 * trigger a recalculation. Returns the caregivers whose level changed.
 */
export async function recalculateAllLevels(
  prisma: PrismaClient,
  settings: SettingsService,
  now: Date = new Date(),
): Promise<LevelChange[]> {
  const requirements = await settings.get('levels.requirements');
  const caregivers = await prisma.caregiverProfile.findMany({
    select: { userId: true, level: true },
    orderBy: { createdAt: 'asc' },
  });

  const changes: LevelChange[] = [];
  for (const { userId, level: from } of caregivers) {
    const to = await prisma.$transaction((tx) => recalculateLevel(tx, userId, requirements, now));
    if (to !== from) {
      changes.push({ caregiverId: userId, from, to });
    }
  }
  return changes;
}
