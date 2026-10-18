import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../common/time/clock.js';
import { StorageService } from '../files/storage.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * How long an upload can stay unfinished or unused before it's deleted. The app
 * finishes and uses an upload right away, and its signed URL lasts 10 minutes.
 */
export const ABANDONED_FILE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Files are deleted in batches, so one run never holds too many rows in memory. */
const FILE_BATCH_SIZE = 100;

/** Housekeeping that nothing else does: rows that only take up space. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly clock: Clock,
  ) {}

  /**
   * Expired refresh tokens can't be used, and the reuse check (see
   * RefreshTokensService) only needs the ones still valid. Returns how many it deleted.
   */
  async deleteExpiredRefreshTokens(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: this.clock.now() } },
    });
    return count;
  }

  /**
   * Deletes the files that were never uploaded, and the uploaded ones that nothing
   * points to: a photo, vaccination record or vet instructions the owner never
   * attached, or a photo that was replaced. Each row goes first, and only if it's
   * still abandoned at that moment; then its object in the bucket. Returns how many
   * it deleted.
   */
  async deleteAbandonedFiles(): Promise<number> {
    const abandoned = abandonedFiles(
      new Date(this.clock.now().getTime() - ABANDONED_FILE_AFTER_MS),
    );
    let deleted = 0;
    for (;;) {
      const files = await this.prisma.file.findMany({
        where: abandoned,
        select: { id: true, storageKey: true },
        orderBy: { createdAt: 'asc' },
        take: FILE_BATCH_SIZE,
      });
      for (const file of files) {
        const { count } = await this.prisma.file.deleteMany({
          where: { id: file.id, ...abandoned },
        });
        if (count === 0) {
          continue;
        }
        deleted += 1;
        try {
          await this.storage.delete(file.storageKey);
        } catch (error) {
          this.logger.warn(
            { storageKey: file.storageKey, error: String(error) },
            'Deleted an abandoned file but not its object in the bucket',
          );
        }
      }
      if (files.length < FILE_BATCH_SIZE) {
        return deleted;
      }
    }
  }
}

/** Created before `cutoff` and either never uploaded or not used by anything. */
function abandonedFiles(cutoff: Date): Prisma.FileWhereInput {
  return {
    createdAt: { lt: cutoff },
    OR: [
      { uploadedAt: null },
      {
        caregiverProfiles: { none: {} },
        pets: { none: {} },
        vaccinations: { none: {} },
        vetInstructions: { none: {} },
      },
    ],
  };
}
