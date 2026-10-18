import { type Payment, PaymentProvider, PaymentStatus } from '../generated/prisma/client.js';
import { currentPayment } from './booking-payment.js';

function payment(id: string, status: PaymentStatus, createdAt: string): Payment {
  const approved = status !== PaymentStatus.PENDING;
  return {
    id,
    bookingId: 'booking',
    provider: PaymentProvider.WOMPI,
    status,
    amountCents: 1870,
    providerLinkId: `link-${id}`,
    checkoutUrl: `https://lk.wompi.test/${id}`,
    providerTransactionId: approved ? `tx-${id}` : null,
    isLive: approved ? false : null,
    approvedAt: approved ? new Date(createdAt) : null,
    refundedAt: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

describe('currentPayment', () => {
  it('is null for a booking without payments', () => {
    expect(currentPayment([])).toBeNull();
  });

  it('shows the latest attempt, with its link while it is pending', () => {
    const shown = currentPayment([
      payment('a', PaymentStatus.REFUND_PENDING, '2026-10-18T15:00:00Z'),
      payment('b', PaymentStatus.PENDING, '2026-10-18T15:05:00Z'),
    ]);

    expect(shown).toMatchObject({
      id: 'b',
      status: 'PENDING',
      checkoutUrl: 'https://lk.wompi.test/b',
    });
  });

  it('keeps showing the payment that confirmed the booking after a later one goes to refund', () => {
    const shown = currentPayment([
      payment('a', PaymentStatus.APPROVED, '2026-10-18T15:00:00Z'),
      payment('b', PaymentStatus.REFUND_PENDING, '2026-10-18T15:05:00Z'),
    ]);

    expect(shown).toMatchObject({ id: 'a', status: 'APPROVED', checkoutUrl: null });
  });
});
