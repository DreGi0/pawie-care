import type { QueueOptions } from 'bullmq';

/** Every queue's Redis keys start with it, so another app can share the same Redis. */
export const QUEUE_PREFIX = 'pawie';

/** How the BullMQ queues and workers reach Redis (docs/arquitectura.md §4.10). */
export function queueOptions(redisUrl: string, prefix = QUEUE_PREFIX): QueueOptions {
  return { connection: { url: redisUrl }, prefix };
}
