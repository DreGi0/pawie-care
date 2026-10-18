import { setTimeout } from 'node:timers/promises';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { toErrorResponse } from '../common/errors/all-exceptions.filter.js';
import { Clock } from '../common/time/clock.js';
import { type Booking, BookingStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JOB_RETENTION } from '../queues/queue-options.js';
import { BookingStateMachine } from './booking-state-machine.js';

export const BOOKING_DEADLINES_QUEUE = 'booking-deadlines';

/** The job that expires one booking when its deadline passes. */
export const EXPIRE_JOB = 'expire';
/** The periodic job that expires whatever is overdue, in case an expire job got lost. */
export const SWEEP_JOB = 'expire-overdue';
const SWEEP_EVERY_MS = 5 * 60_000;

/** Adding a job waits for Redis; past this, the sweep takes over (see schedule()). */
const ENQUEUE_TIMEOUT_MS = 2_000;

/** The statuses that wait for someone before a deadline. */
type WaitingStatus = typeof BookingStatus.REQUESTED | typeof BookingStatus.PENDING_PAYMENT;

export interface ExpireJobData {
  bookingId: string;
  /** The status the deadline belongs to. If the booking left it, the job does nothing. */
  status: WaitingStatus;
}

export type ExpireResult = 'expired' | 'moved-on' | 'not-due';

type BookingDeadline = Pick<Booking, 'id' | 'status' | 'responseDueAt' | 'paymentDueAt'>;

/**
 * The deadlines of a booking (docs/arquitectura.md §4.10): the caregiver's answer while
 * REQUESTED (RN-RES-06) and the payment while PENDING_PAYMENT (RN-RES-07). Each one is
 * a delayed BullMQ job that expires the booking when it runs, after checking that the
 * booking is still waiting in that status. A sweep every 5 minutes expires whatever is
 * overdue, in case a job was never added or got lost.
 */
@Injectable()
export class BookingDeadlines implements OnModuleInit {
  private readonly logger = new Logger(BookingDeadlines.name);

  constructor(
    @InjectQueue(BOOKING_DEADLINES_QUEUE) private readonly queue: Queue<ExpireJobData>,
    private readonly prisma: PrismaService,
    private readonly stateMachine: BookingStateMachine,
    private readonly clock: Clock,
  ) {
    this.queue.on('error', (error) => {
      this.logger.warn({ error: String(error) }, 'Booking deadlines queue error');
    });
  }

  onModuleInit(): void {
    // Not awaited: the API starts even if Redis is down, and this runs once it's back.
    this.queue
      .upsertJobScheduler(
        SWEEP_JOB,
        { every: SWEEP_EVERY_MS },
        { name: SWEEP_JOB, opts: JOB_RETENTION },
      )
      .catch((error: unknown) => {
        this.logger.error({ error: String(error) }, 'Could not schedule the deadline sweep');
      });
  }

  /**
   * Schedules the expiry of a booking that waits for the caregiver or for payment. It
   * never fails the request that created the deadline: if Redis doesn't answer, the
   * sweep expires the booking instead.
   */
  async schedule(booking: BookingDeadline): Promise<void> {
    const deadline = deadlineOf(booking);
    if (!deadline) {
      return;
    }
    const timeout = new AbortController();
    try {
      await Promise.race([
        this.queue.add(
          EXPIRE_JOB,
          { bookingId: booking.id, status: deadline.status },
          {
            // One job per booking and status, so scheduling twice adds nothing.
            jobId: `${booking.id}-${deadline.status}`,
            delay: Math.max(0, deadline.dueAt.getTime() - this.clock.now().getTime()),
            attempts: 5,
            backoff: { type: 'exponential', delay: 10_000 },
            ...JOB_RETENTION,
          },
        ),
        setTimeout(ENQUEUE_TIMEOUT_MS, undefined, { signal: timeout.signal }).then(() => {
          throw new Error(`Redis did not answer within ${ENQUEUE_TIMEOUT_MS} ms`);
        }),
      ]);
    } catch (error) {
      this.logger.error(
        { bookingId: booking.id, error: String(error) },
        'Could not schedule the booking deadline; the sweep will expire it',
      );
    } finally {
      timeout.abort();
    }
  }

  /**
   * Expires the booking if it's still waiting in `status` and its deadline passed.
   * Says why it didn't otherwise: the booking moved on (it was answered, paid or
   * cancelled), or its deadline hasn't come yet.
   */
  async expire(bookingId: string, status: WaitingStatus): Promise<ExpireResult> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    const deadline = booking && deadlineOf(booking);
    if (!deadline || deadline.status !== status) {
      return 'moved-on';
    }
    if (deadline.dueAt > this.clock.now()) {
      return 'not-due';
    }
    try {
      await this.stateMachine.transition(bookingId, {
        from: status,
        to: BookingStatus.EXPIRED,
        changedById: null,
        reason:
          status === BookingStatus.REQUESTED
            ? 'RN-RES-06: el cuidador no respondió a tiempo.'
            : 'RN-RES-07: el dueño no pagó a tiempo.',
      });
      return 'expired';
    } catch (error) {
      // Paid, answered or cancelled just now.
      if (toErrorResponse(error).errorCode === 'BOOKING_STATUS_CHANGED') {
        return 'moved-on';
      }
      throw error;
    }
  }

  /** Expires every booking whose deadline passed. Returns how many it expired. */
  async expireOverdue(): Promise<number> {
    const now = this.clock.now();
    const overdue = await this.prisma.booking.findMany({
      where: {
        OR: [
          { status: BookingStatus.REQUESTED, responseDueAt: { lte: now } },
          { status: BookingStatus.PENDING_PAYMENT, paymentDueAt: { lte: now } },
        ],
      },
      select: { id: true, status: true },
    });
    let expired = 0;
    for (const { id, status } of overdue) {
      if ((await this.expire(id, status as WaitingStatus)) === 'expired') {
        expired += 1;
      }
    }
    if (expired > 0) {
      this.logger.warn({ expired }, 'Expired overdue bookings that had no deadline job');
    }
    return expired;
  }
}

/** The deadline running for the booking, if it's waiting for someone. */
function deadlineOf(booking: BookingDeadline): { status: WaitingStatus; dueAt: Date } | null {
  if (booking.status === BookingStatus.REQUESTED && booking.responseDueAt) {
    return { status: booking.status, dueAt: booking.responseDueAt };
  }
  if (booking.status === BookingStatus.PENDING_PAYMENT && booking.paymentDueAt) {
    return { status: booking.status, dueAt: booking.paymentDueAt };
  }
  return null;
}
