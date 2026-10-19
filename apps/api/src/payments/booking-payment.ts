import { type Payment, PaymentStatus } from '../generated/prisma/client.js';
import type { BookingPayment } from './payments.dto.js';

export function toBookingPayment(payment: Payment): BookingPayment {
  return {
    id: payment.id,
    status: payment.status,
    amountCents: payment.amountCents,
    // The link only matters while it can be paid.
    checkoutUrl: payment.status === PaymentStatus.PENDING ? payment.checkoutUrl : null,
    approvedAt: payment.approvedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

/**
 * The payment a booking shows: the one that paid it, or else the latest attempt. A
 * later approval that goes to refund doesn't hide the payment that confirmed it.
 */
export function currentPayment(payments: Payment[]): BookingPayment | null {
  const latestFirst = payments.toSorted(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );
  const shown =
    latestFirst.find(({ status }) => status === PaymentStatus.APPROVED) ?? latestFirst.at(0);
  return shown ? toBookingPayment(shown) : null;
}
