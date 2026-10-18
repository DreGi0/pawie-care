import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  BOOKING_DEADLINES_QUEUE,
  BookingDeadlines,
  EXPIRE_JOB,
  type ExpireJobData,
  type ExpireResult,
  SWEEP_JOB,
} from './booking-deadlines.js';

/** Runs the jobs of the booking deadlines queue (see BookingDeadlines). */
@Processor(BOOKING_DEADLINES_QUEUE)
export class BookingDeadlinesProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingDeadlinesProcessor.name);

  constructor(private readonly deadlines: BookingDeadlines) {
    super();
  }

  process(job: Job<ExpireJobData>): Promise<ExpireResult | number> {
    switch (job.name) {
      case EXPIRE_JOB:
        return this.deadlines.expire(job.data.bookingId, job.data.status);
      case SWEEP_JOB:
        return this.deadlines.expireOverdue();
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ExpireJobData> | undefined, error: Error): void {
    this.logger.error({ job: job?.id, error: error.message }, 'Booking deadline job failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.warn({ error: error.message }, 'Booking deadlines worker error');
  }
}
