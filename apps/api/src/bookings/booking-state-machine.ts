import { ConflictException, Injectable } from '@nestjs/common';
import {
  type Booking,
  BookingStatus,
  type PrismaClient,
  type Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isSlotOverlap, slotTaken } from './booking-errors.js';
import { blocksCalendar, canTransition } from './booking-status.js';

export interface StatusChange {
  /** The status the caller saw. If the booking moved on since, nothing changes. */
  from: BookingStatus;
  to: BookingStatus;
  /** Who made the change. Null when the system did, such as an expiry or a webhook. */
  changedById: string | null;
  reason?: string;
  /** RN-RES-07: required to enter PENDING_PAYMENT. */
  paymentDueAt?: Date;
}

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Applies the status changes of BOOKING_TRANSITIONS (docs/arquitectura.md §4.7). Each
 * change updates the status and blocks_calendar together, which the foreign key
 * cascades to the slots, and records a BookingStatusChange, all in one transaction.
 */
@Injectable()
export class BookingStateMachine {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Moves the booking from `change.from` to `change.to`, inside `tx` if given. Throws
   * INVALID_STATUS_TRANSITION for a change the table doesn't allow,
   * BOOKING_STATUS_CHANGED if the booking is no longer in `change.from`, and
   * SLOT_TAKEN if holding the calendar again collides with another booking.
   */
  async transition(bookingId: string, change: StatusChange, tx?: Client): Promise<Booking> {
    if (!canTransition(change.from, change.to)) {
      throw new ConflictException({
        errorCode: 'INVALID_STATUS_TRANSITION',
        message: 'Esta reserva ya no puede cambiar a ese estado.',
        details: { from: change.from, to: change.to },
      });
    }
    if (change.to === BookingStatus.PENDING_PAYMENT && !change.paymentDueAt) {
      throw new Error('A booking waiting for payment needs its payment deadline');
    }
    try {
      return tx
        ? await this.apply(tx, bookingId, change)
        : await this.prisma.$transaction((client) => this.apply(client, bookingId, change));
    } catch (error) {
      if (isSlotOverlap(error)) {
        throw slotTaken();
      }
      throw error;
    }
  }

  private async apply(
    client: Client,
    bookingId: string,
    { from, to, changedById, reason, paymentDueAt }: StatusChange,
  ): Promise<Booking> {
    // Only one request can move it out of `from`, even if two arrive at the same time.
    const { count } = await client.booking.updateMany({
      where: { id: bookingId, status: from },
      data: {
        status: to,
        blocksCalendar: blocksCalendar(to),
        ...(paymentDueAt && { paymentDueAt }),
      },
    });
    if (count === 0) {
      throw new ConflictException({
        errorCode: 'BOOKING_STATUS_CHANGED',
        message: 'La reserva cambió mientras tanto. Vuelve a cargarla.',
      });
    }
    await client.bookingStatusChange.create({
      data: { bookingId, fromStatus: from, toStatus: to, changedById, reason },
    });
    return client.booking.findUniqueOrThrow({ where: { id: bookingId } });
  }
}
