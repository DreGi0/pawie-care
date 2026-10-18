import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { JOB_RETENTION } from '../queues/queue-options.js';
import { PaymentWebhooks } from './payment-webhooks.js';

export const PAYMENTS_QUEUE = 'payments';

/** The periodic job that applies the webhook events that couldn't be applied when they arrived. */
export const RETRY_WEBHOOKS_JOB = 'retry-webhooks';
const RETRY_EVERY_MS = 5 * 60_000;

/** Runs the jobs of the payments queue (see PaymentWebhooks.retryPending()). */
@Processor(PAYMENTS_QUEUE)
export class PaymentsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(
    @InjectQueue(PAYMENTS_QUEUE) private readonly queue: Queue,
    private readonly webhooks: PaymentWebhooks,
  ) {
    super();
    this.queue.on('error', (error) => {
      this.logger.warn({ error: String(error) }, 'Payments queue error');
    });
  }

  onModuleInit(): void {
    // Not awaited: the API starts even if Redis is down, and this runs once it's back.
    this.queue
      .upsertJobScheduler(
        RETRY_WEBHOOKS_JOB,
        { every: RETRY_EVERY_MS },
        { name: RETRY_WEBHOOKS_JOB, opts: JOB_RETENTION },
      )
      .catch((error: unknown) => {
        this.logger.error({ error: String(error) }, 'Could not schedule the webhook retries');
      });
  }

  process(job: Job): Promise<number> {
    if (job.name !== RETRY_WEBHOOKS_JOB) {
      throw new Error(`Unknown job ${job.name}`);
    }
    return this.webhooks.retryPending();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error({ job: job?.name, error: error.message }, 'Payments job failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.warn({ error: error.message }, 'Payments worker error');
  }
}
