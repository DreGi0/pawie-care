import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { BookingStateMachine } from '../bookings/booking-state-machine.js';
import { canTransition } from '../bookings/booking-status.js';
import { toErrorResponse } from '../common/errors/all-exceptions.filter.js';
import { Clock } from '../common/time/clock.js';
import type { WompiSettings } from '../config/environment.js';
import {
  type Booking,
  BookingStatus,
  type Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type WompiApi, WompiClient, type WompiTransaction } from './wompi.client.js';
import { hasValidWompiSignature, parseWompiWebhook } from './wompi-webhook.js';
import { WOMPI_SETTINGS } from './wompi-settings.js';

/** What applying a webhook event did. */
export type WebhookOutcome =
  /** RN-PAG-02, or RN-PAG-06 for a late payment whose time was still free. */
  | 'confirmed'
  /** Approved, but it couldn't confirm the booking (RN-PAG-06, RN-PAG-07). */
  | 'refund-pending'
  /** That transaction was already applied. */
  | 'already-applied'
  /** No payment has that reference and link: nothing to apply. */
  | 'unknown-payment'
  /** Wompi's query doesn't report it as approved (yet). It's retried. */
  | 'not-approved';

/** Payments that already hold an approved transaction. */
const SETTLED: readonly PaymentStatus[] = [
  PaymentStatus.APPROVED,
  PaymentStatus.REFUND_PENDING,
  PaymentStatus.REFUNDED,
];

/** Times a webhook reads the booking again when it changes while the payment is applied. */
const MAX_APPLY_ATTEMPTS = 3;

/** An event that couldn't be applied is retried after this long, and for this long. */
const RETRY_AFTER_MS = 60_000;
const RETRY_FOR_MS = 24 * 60 * 60_000;

type Client = PrismaClient | Prisma.TransactionClient;

interface Approval {
  eventId: string;
  paymentId: string;
  transaction: WompiTransaction;
  approvedAt: Date;
  /** False once confirming failed because another booking took the time (RN-PAG-06). */
  mayConfirm: boolean;
}

/**
 * Wompi's webhooks (docs/arquitectura.md §6). A booking is confirmed only here, never by
 * the owner's return to the app (RN-PAG-02).
 */
@Injectable()
export class PaymentWebhooks {
  private readonly logger = new Logger(PaymentWebhooks.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WompiClient) private readonly wompi: WompiApi,
    @Inject(WOMPI_SETTINGS) private readonly settings: WompiSettings | null,
    private readonly stateMachine: BookingStateMachine,
    private readonly clock: Clock,
  ) {}

  /**
   * Checks the signature, stores the event once per IdTransaccion, and applies it. Wompi
   * gets its 200 once the event is stored: if it can't be applied now, the event keeps
   * the reason and is retried.
   */
  async receive(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    const { settings } = this;
    if (!settings) {
      throw new ServiceUnavailableException({
        errorCode: 'PAYMENTS_UNAVAILABLE',
        message: 'Los pagos no están disponibles en este momento.',
      });
    }
    if (!rawBody) {
      // Nest keeps the raw body of JSON and form bodies only.
      this.logger.error('A payment webhook arrived without a JSON body');
      throw new BadRequestException({
        errorCode: 'INVALID_WEBHOOK',
        message: 'El aviso de pago no trae un cuerpo JSON.',
      });
    }
    if (!hasValidWompiSignature(rawBody, signature, settings.apiSecret)) {
      // Not stored: a forged event could otherwise claim a real IdTransaccion first.
      this.logger.warn('Rejected a payment webhook with an invalid signature');
      throw new UnauthorizedException({
        errorCode: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'La firma del aviso de pago no es válida.',
      });
    }
    const payload = parseJson(rawBody);
    const webhook = parseWompiWebhook(payload);
    if (!webhook) {
      this.logger.error(
        'A signed payment webhook has no IdTransaccion or IdentificadorEnlaceComercio',
      );
      throw new BadRequestException({
        errorCode: 'INVALID_WEBHOOK',
        message: 'El aviso de pago no dice qué transacción ni qué enlace se pagó.',
      });
    }

    const event = await this.record(webhook.transactionId, payload as Prisma.InputJsonValue);
    // A repeated webhook changes nothing.
    if (event.processedAt) {
      return;
    }
    try {
      await this.process(event.id);
    } catch (error) {
      this.logger.error(
        { eventId: event.id, error: String(error) },
        'Could not apply a payment webhook; it will be retried',
      );
    }
  }

  /**
   * Applies a stored event: queries the transaction, and if Wompi reports it approved,
   * changes the payment and the booking together. Throws if Wompi or the database fail,
   * after recording why on the event.
   */
  async process(eventId: string): Promise<WebhookOutcome> {
    const event = await this.prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    const webhook = parseWompiWebhook(event.payload);
    if (event.processedAt || !webhook) {
      return 'already-applied';
    }
    const payment = isUUID(webhook.reference)
      ? await this.prisma.payment.findUnique({ where: { id: webhook.reference } })
      : null;
    if (!payment || (webhook.linkId !== null && payment.providerLinkId !== webhook.linkId)) {
      // Nothing to retry: it stays recorded for review.
      await this.finish(this.prisma, eventId, null, 'No payment matches the payment link');
      this.logger.error(
        { eventId, reference: webhook.reference },
        'Webhook for an unknown payment',
      );
      return 'unknown-payment';
    }

    try {
      const transaction = await this.wompi.getTransaction(webhook.transactionId);
      if (!transaction?.approved) {
        await this.prisma.webhookEvent.update({
          where: { id: eventId },
          data: {
            paymentId: payment.id,
            error: 'Wompi does not report the transaction as approved',
          },
        });
        this.logger.warn(
          { eventId, paymentId: payment.id },
          'Wompi does not confirm the transaction',
        );
        return 'not-approved';
      }
      return await this.apply({
        eventId,
        paymentId: payment.id,
        transaction,
        approvedAt: webhook.paidAt ?? this.clock.now(),
        mayConfirm: true,
      });
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { paymentId: payment.id, error: String(error).slice(0, 1000) },
      });
      throw error;
    }
  }

  /**
   * Applies the events that couldn't be applied when they arrived, because Wompi didn't
   * answer the query or didn't report the transaction as approved yet. Each one is
   * retried for a day; after that it stays with its error, for review. Returns how many
   * it applied.
   */
  async retryPending(): Promise<number> {
    const now = this.clock.now().getTime();
    const events = await this.prisma.webhookEvent.findMany({
      where: {
        processedAt: null,
        // Not the ones that just arrived, which their own request is applying.
        receivedAt: { lte: new Date(now - RETRY_AFTER_MS), gte: new Date(now - RETRY_FOR_MS) },
      },
      select: { id: true },
      orderBy: { receivedAt: 'asc' },
    });
    let applied = 0;
    for (const { id } of events) {
      try {
        if ((await this.process(id)) !== 'not-approved') {
          applied += 1;
        }
      } catch (error) {
        this.logger.warn({ eventId: id, error: String(error) }, 'A payment webhook still fails');
      }
    }
    return applied;
  }

  private async apply(approval: Approval): Promise<WebhookOutcome> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction((tx) => this.applyIn(tx, approval));
      } catch (error) {
        const { errorCode } = toErrorResponse(error);
        // RN-PAG-06: paid late, and another booking took the time meanwhile. The failed
        // transaction rolled back, so this one only marks the payment for refund.
        if (errorCode === 'SLOT_TAKEN' && approval.mayConfirm) {
          return this.prisma.$transaction((tx) =>
            this.applyIn(tx, { ...approval, mayConfirm: false }),
          );
        }
        // The deadline, the owner or another payment moved the booking: read it again.
        if (errorCode === 'BOOKING_STATUS_CHANGED' && attempt < MAX_APPLY_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }
  }

  /** Applies one approved transaction to its payment, and to the booking if it confirms it. */
  private async applyIn(tx: Prisma.TransactionClient, approval: Approval): Promise<WebhookOutcome> {
    const { eventId, paymentId, transaction, approvedAt } = approval;
    // The webhooks of a payment wait for each other here.
    await tx.$queryRaw`SELECT 1 FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.providerTransactionId === transaction.id) {
      await this.finish(tx, eventId, paymentId);
      return 'already-applied';
    }
    const approved = {
      approvedAt,
      providerTransactionId: transaction.id,
      isLive: transaction.isLive,
    };

    if (SETTLED.includes(payment.status)) {
      // RN-PAG-07: another approved transaction on a link that takes one. It gets a
      // payment of its own, to refund.
      const extra = await tx.payment.create({
        data: {
          bookingId: payment.bookingId,
          provider: PaymentProvider.WOMPI,
          amountCents: transaction.amountCents,
          status: PaymentStatus.REFUND_PENDING,
          ...approved,
        },
      });
      await this.finish(tx, eventId, extra.id);
      this.refundNeeded(extra, 'a second transaction on a link that takes one');
      return 'refund-pending';
    }

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
    const refundReason = whyNotConfirm(approval, payment, booking);
    if (!refundReason) {
      const late = booking.status === BookingStatus.EXPIRED;
      await this.stateMachine.transition(
        booking.id,
        {
          from: booking.status,
          to: BookingStatus.CONFIRMED,
          changedById: null,
          reason: late
            ? 'RN-PAG-06: Wompi aprobó el pago después del plazo y el horario seguía libre.'
            : 'RN-PAG-02: Wompi aprobó el pago.',
        },
        tx,
      );
    }
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: refundReason ? PaymentStatus.REFUND_PENDING : PaymentStatus.APPROVED,
        ...approved,
      },
    });
    await this.finish(tx, eventId, paymentId);
    if (refundReason) {
      this.refundNeeded(updated, refundReason);
      return 'refund-pending';
    }
    return 'confirmed';
  }

  /** Stores the event once per IdTransaccion. */
  private async record(transactionId: string, payload: Prisma.InputJsonValue) {
    const key = { provider: PaymentProvider.WOMPI, externalId: transactionId };
    try {
      return await this.prisma.webhookEvent.create({ data: { ...key, payload } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.webhookEvent.findUniqueOrThrow({ where: { provider_externalId: key } });
      }
      throw error;
    }
  }

  private finish(
    client: Client,
    eventId: string,
    paymentId: string | null,
    error: string | null = null,
  ) {
    return client.webhookEvent.update({
      where: { id: eventId },
      data: { processedAt: this.clock.now(), paymentId, error },
    });
  }

  /** RN-PAG-05: refunds are made from the Wompi panel, so someone has to see it. */
  private refundNeeded(payment: Payment, reason: string): void {
    this.logger.warn(
      {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amountCents: payment.amountCents,
        reason,
      },
      'Approved payment to refund from the Wompi panel (RN-PAG-05)',
    );
  }
}

/** Why an approved payment can't confirm its booking, or null if it can. */
function whyNotConfirm(
  { transaction, mayConfirm }: Approval,
  payment: Payment,
  booking: Pick<Booking, 'status'>,
): string | null {
  if (!mayConfirm) {
    return 'the booking expired and another booking took its time';
  }
  if (transaction.amountCents !== payment.amountCents) {
    return `Wompi charged ${transaction.amountCents} cents instead of ${payment.amountCents}`;
  }
  if (canTransition(booking.status, BookingStatus.CONFIRMED)) {
    return null;
  }
  return booking.status === BookingStatus.CANCELLED_BY_OWNER
    ? 'the owner cancelled the booking'
    : `the booking is ${booking.status}, so it was already paid or can't be paid`;
}

function parseJson(rawBody: Buffer): unknown {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
}
