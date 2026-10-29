import { NON_BLOCKING_STATUSES } from '../bookings/booking-status.js';
import type { Prisma } from '../generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** RN-PRE-09: the last instant at which the owner can still create the booking. */
export function firstServiceWindowEnd(registeredAt: Date, windowDays: number): Date {
  return new Date(registeredAt.getTime() + windowDays * DAY_MS);
}

/**
 * RN-PRE-09: when the owner's first service is free of the service fee, the end of the
 * window; otherwise null. It's free within the window, if the owner never paid a
 * booking and no other active booking holds the incentive. A booking that is
 * rejected, expired or cancelled without being paid releases it.
 *
 * Call it inside a transaction that locked the owner's row to decide a booking, so two
 * requests at once can't both take it.
 */
export async function firstServiceFeeWaiverEndsAt(
  db: Pick<Prisma.TransactionClient, 'user' | 'booking'>,
  ownerId: string,
  windowDays: number,
  now: Date,
): Promise<Date | null> {
  const { createdAt } = await db.user.findUniqueOrThrow({
    where: { id: ownerId },
    select: { createdAt: true },
  });
  const endsAt = firstServiceWindowEnd(createdAt, windowDays);
  if (now > endsAt) {
    return null;
  }
  const taken = await db.booking.findFirst({
    where: {
      ownerId,
      OR: [
        { payments: { some: { approvedAt: { not: null } } } },
        { firstServiceFeeWaived: true, status: { notIn: [...NON_BLOCKING_STATUSES] } },
      ],
    },
    select: { id: true },
  });
  return taken ? null : endsAt;
}
