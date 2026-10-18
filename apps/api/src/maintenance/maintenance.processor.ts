import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { JOB_RETENTION } from '../queues/queue-options.js';
import { MaintenanceService } from './maintenance.service.js';

export const MAINTENANCE_QUEUE = 'maintenance';

/** Each task runs every hour; they're cheap and do nothing when there's nothing to clean. */
const TASKS = {
  'delete-expired-refresh-tokens': (maintenance: MaintenanceService) =>
    maintenance.deleteExpiredRefreshTokens(),
  'delete-abandoned-files': (maintenance: MaintenanceService) => maintenance.deleteAbandonedFiles(),
} as const;
const EVERY_MS = 60 * 60_000;

type TaskName = keyof typeof TASKS;

/** Runs the periodic housekeeping of MaintenanceService. */
@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
    private readonly maintenance: MaintenanceService,
  ) {
    super();
    this.queue.on('error', (error) => {
      this.logger.warn({ error: String(error) }, 'Maintenance queue error');
    });
  }

  onModuleInit(): void {
    // Not awaited: the API starts even if Redis is down, and these run once it's back.
    for (const name of Object.keys(TASKS)) {
      this.queue
        .upsertJobScheduler(name, { every: EVERY_MS }, { name, opts: JOB_RETENTION })
        .catch((error: unknown) => {
          this.logger.error(
            { task: name, error: String(error) },
            'Could not schedule a maintenance task',
          );
        });
    }
  }

  async process(job: Job): Promise<number> {
    if (!Object.hasOwn(TASKS, job.name)) {
      throw new Error(`Unknown job ${job.name}`);
    }
    const deleted = await TASKS[job.name as TaskName](this.maintenance);
    if (deleted > 0) {
      this.logger.log({ task: job.name, deleted }, 'Maintenance task deleted rows');
    }
    return deleted;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error({ task: job?.name, error: error.message }, 'Maintenance task failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.warn({ error: error.message }, 'Maintenance worker error');
  }
}
