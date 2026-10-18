import type { QueueOptions } from 'bullmq';

/** Every queue's Redis keys start with it, so another app can share the same Redis. */
export const QUEUE_PREFIX = 'pawie';

/** How the BullMQ queues and workers reach Redis (docs/arquitectura.md §4.10). */
export function queueOptions(redisUrl: string, prefix = QUEUE_PREFIX): QueueOptions {
  return { connection: { url: redisUrl }, prefix };
}

/**
 * What every job leaves behind: a completed job goes away at once, and a failed one
 * stays a week so it can be looked into. Otherwise Redis keeps every job forever.
 */
export const JOB_RETENTION = {
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const;
