import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { bookingNotFound } from '../bookings/booking-errors.js';
import { caregiverDisplayName } from '../caregivers/caregivers.service.js';
import { Clock } from '../common/time/clock.js';
import type { WompiSettings } from '../config/environment.js';
import { BookingStatus, PaymentProvider, PaymentStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toBookingPayment } from './booking-payment.js';
import type { BookingPayment } from './payments.dto.js';
import { type WompiApi, WompiClient, WompiError } from './wompi.client.js';
import { WOMPI_SETTINGS } from './wompi-settings.js';

/** Routes Wompi calls, under the API's public URL (PUBLIC_API_URL). */
export const PAYMENT_WEBHOOK_PATH = 'payments/webhook';
export const PAYMENT_RETURN_PATH = 'payments/return';

/** The app's screen after paying. expo-web-browser closes the payment page when it gets here. */
export const APP_PAYMENT_RESULT_URL = 'pawie://payment/result';

/**
 * Creating the link holds a lock on the booking while it calls Wompi, which can take a
 * token request and the link itself, each with its own timeout.
 */
const START_TRANSACTION_TIMEOUT_MS = 60_000;

/** Payments of bookings with Wompi (RN-PAG, docs/arquitectura.md §6). */
@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WompiClient) private readonly wompi: WompiApi,
    @Inject(WOMPI_SETTINGS) private readonly settings: WompiSettings | null,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    if (!this.settings) {
      this.logger.warn(
        'Payments are off: WOMPI_APP_ID, WOMPI_API_SECRET and PUBLIC_API_URL are not set',
      );
    }
  }

  /**
   * RN-PAG-02: the owner pays the booking's total (RN-PRE-07) on a Wompi payment link
   * while it waits for payment (RN-RES-07). While a link is pending, paying again
   * returns the same one: it takes a single payment and expires with the deadline.
   */
  async start(ownerId: string, bookingId: string): Promise<BookingPayment> {
    const { settings } = this;
    if (!settings) {
      throw new ServiceUnavailableException({
        errorCode: 'PAYMENTS_UNAVAILABLE',
        message: 'Los pagos no están disponibles en este momento. Intenta de nuevo más tarde.',
      });
    }
    const details = await this.prisma.booking.findFirst({
      where: { id: bookingId, ownerId },
      select: { service: true, caregiver: { select: { user: true } } },
    });
    if (!details) {
      throw bookingNotFound();
    }
    const productName = `Reserva Pawie: ${details.service.name} con ${caregiverDisplayName(details.caregiver.user)}`;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Two taps on "Pagar" wait for each other here, so they get the same link.
          await tx.$queryRaw`SELECT 1 FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE`;
          // One relation only: inside a transaction, Prisma would run several at once
          // on the same connection, which pg deprecates.
          const booking = await tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
            include: { payments: { where: { status: PaymentStatus.PENDING } } },
          });
          const dueAt = booking.paymentDueAt;
          if (
            booking.status !== BookingStatus.PENDING_PAYMENT ||
            !dueAt ||
            dueAt <= this.clock.now()
          ) {
            throw notPayable(booking.status);
          }
          const [pending] = booking.payments;
          if (pending) {
            return toBookingPayment(pending);
          }

          const payment = await tx.payment.create({
            data: {
              bookingId,
              provider: PaymentProvider.WOMPI,
              amountCents: booking.totalCents,
            },
          });
          const link = await this.wompi.createPaymentLink({
            // The webhook brings it back, so it says which attempt was paid.
            reference: payment.id,
            amountCents: payment.amountCents,
            productName,
            redirectUrl: `${settings.publicApiUrl}/v1/${PAYMENT_RETURN_PATH}`,
            webhookUrl: `${settings.publicApiUrl}/v1/${PAYMENT_WEBHOOK_PATH}`,
            expiresAt: dueAt,
          });
          return toBookingPayment(
            await tx.payment.update({
              where: { id: payment.id },
              data: { providerLinkId: link.id, checkoutUrl: link.url },
            }),
          );
        },
        { timeout: START_TRANSACTION_TIMEOUT_MS },
      );
    } catch (error) {
      // The transaction rolled back, so no payment is left without its link.
      if (error instanceof WompiError) {
        this.logger.error({ bookingId, error: error.message }, 'Could not create the payment link');
        throw new BadGatewayException({
          errorCode: 'PAYMENT_GATEWAY_ERROR',
          message: 'No pudimos conectar con la pasarela de pago. Intenta de nuevo en un momento.',
        });
      }
      throw error;
    }
  }

  /**
   * Where Wompi's redirect sends the owner: the app, with the booking and the payment
   * when the reference is one of ours. It changes nothing: only the webhook confirms a
   * booking (RN-PAG-02), so the app waits for it by reading the booking.
   */
  async appReturnUrl(reference: string | undefined): Promise<string> {
    const payment =
      reference && isUUID(reference)
        ? await this.prisma.payment.findUnique({
            where: { id: reference },
            select: { id: true, bookingId: true },
          })
        : null;
    const url = new URL(APP_PAYMENT_RESULT_URL);
    if (payment) {
      url.searchParams.set('bookingId', payment.bookingId);
      url.searchParams.set('paymentId', payment.id);
    }
    return url.toString();
  }
}

/** Why the booking can't be paid now. */
function notPayable(status: BookingStatus): ConflictException {
  const messages: Partial<Record<BookingStatus, string>> = {
    [BookingStatus.REQUESTED]: 'El cuidador todavía no acepta la reserva.',
    [BookingStatus.PENDING_PAYMENT]: 'Venció el plazo para pagar esta reserva.',
    [BookingStatus.EXPIRED]: 'Venció el plazo para pagar esta reserva.',
    [BookingStatus.CONFIRMED]: 'Esta reserva ya está pagada.',
  };
  return new ConflictException({
    errorCode: 'BOOKING_NOT_PAYABLE',
    message: messages[status] ?? 'Esta reserva ya no se puede pagar.',
    details: { status },
  });
}
