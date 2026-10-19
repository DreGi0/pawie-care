import { randomUUID } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { BookingDeadlines } from '../src/bookings/booking-deadlines.js';
import { BookingsService } from '../src/bookings/bookings.service.js';
import { addDays, dateInElSalvador, formatDateOnly } from '../src/common/time/calendar.js';
import { Clock } from '../src/common/time/clock.js';
import { Role } from '../src/generated/prisma/client.js';
import { PaymentWebhooks } from '../src/payments/payment-webhooks.js';
import { PAYMENTS_QUEUE, RETRY_WEBHOOKS_JOB } from '../src/payments/payments.processor.js';
import { WompiClient, WompiError } from '../src/payments/wompi.client.js';
import { WOMPI_SETTINGS } from '../src/payments/wompi-settings.js';
import { seedDatabase } from '../src/seed/seed-database.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { FakeWompi, signWebhook, type WompiDelivery, webhookFor } from './fake-wompi.js';
import { createUser } from './factories.js';
import { TestClock } from './test-clock.js';
import { useApi } from './use-api.js';

const HOUR_MS = 60 * 60 * 1000;

interface BookingBody {
  id: string;
  status: string;
  paymentDueAt: string | null;
  price: { totalCents: number };
  payment: { id: string; status: string; checkoutUrl: string | null } | null;
  caregiver: { phone: string | null };
}

describe('payments (RN-PAG)', () => {
  let db: TestDatabase;
  let carlos: string;
  const clock = new TestClock();
  const wompi = new FakeWompi();

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.prisma, new SettingsService(db.prisma));
    carlos = (
      await db.prisma.user.findFirstOrThrow({
        where: { firstName: 'Carlos', roles: { has: Role.CAREGIVER } },
      })
    ).id;
  });

  afterAll(async () => {
    await db.close();
  });

  const api = useApi(() => db, {
    override: (builder) =>
      builder.overrideProvider(Clock).useValue(clock).overrideProvider(WompiClient).useValue(wompi),
  });

  afterEach(() => {
    clock.reset();
    wompi.failure = null;
    wompi.queryFailure = null;
  });

  let lastSlot = 0;
  /**
   * A one-hour visit with Carlos, four days ahead or more, so the payment window is the
   * full 2 h (RN-RES-07). Carlos works from 07:00 to 19:00 every day.
   */
  function nextVisit(): string {
    const slot = lastSlot++;
    const date = formatDateOnly(addDays(dateInElSalvador(new Date()), 4 + Math.floor(slot / 10)));
    return `${date}T${String(7 + (slot % 10)).padStart(2, '0')}:00:00-06:00`;
  }

  /** A new owner in Santa Tecla, with a dog. */
  async function owner() {
    const user = await createUser(db.prisma);
    const district = await db.prisma.district.findUniqueOrThrow({ where: { slug: 'santa-tecla' } });
    const dog = await db.prisma.species.findUniqueOrThrow({ where: { code: 'DOG' } });
    const address = await db.prisma.address.create({
      data: { userId: user.id, label: 'Casa', street: 'Calle 1', districtId: district.id },
    });
    const pet = await db.prisma.pet.create({
      data: {
        ownerId: user.id,
        speciesId: dog.id,
        name: 'Toby',
        birthDate: new Date('2019-01-01'),
        sex: 'MALE',
      },
    });
    const token = await api.tokenFor(user);
    return {
      user,
      /** Books Carlos, who has instant booking, so the booking waits for payment. */
      book: async (visit = nextVisit()) => {
        const { body } = await api
          .http()
          .post('/v1/bookings')
          .auth(token, { type: 'bearer' })
          .send({
            caregiverId: carlos,
            serviceCode: 'HOME_VISIT',
            visits: [visit],
            petIds: [pet.id],
            addressId: address.id,
            emergency: {
              contactName: 'Luis Pérez',
              contactPhone: '+503 7000 0000',
              preauthorizedCents: 5000,
              clinicConsent: true,
            },
          })
          .expect(201);
        return body as BookingBody;
      },
      pay: (bookingId: string) =>
        api.http().post(`/v1/bookings/${bookingId}/payments`).auth(token, { type: 'bearer' }),
      get: async (bookingId: string) =>
        (
          await api
            .http()
            .get(`/v1/bookings/${bookingId}`)
            .auth(token, { type: 'bearer' })
            .expect(200)
        ).body as BookingBody,
    };
  }

  type Owner = Awaited<ReturnType<typeof owner>>;

  /** The owner opens the payment page: the Wompi link of the booking. */
  async function checkout(someone: Owner, bookingId: string) {
    const { body } = await someone.pay(bookingId).expect(200);
    return wompi.linkOf((body as { id: string }).id);
  }

  /** Wompi calls the webhook, with its signature unless the test gives another. */
  const deliver = (delivery: WompiDelivery, signature: string | null = delivery.signature) => {
    const call = api.http().post('/v1/payments/webhook').set('content-type', 'application/json');
    return (signature === null ? call : call.set('wompi_hash', signature)).send(delivery.body);
  };

  const paymentRow = (id: string) => db.prisma.payment.findUniqueOrThrow({ where: { id } });
  const bookingRow = (id: string) =>
    db.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { statusChanges: { orderBy: { createdAt: 'asc' } }, payments: true },
    });
  const eventsOf = (transactionId: string) =>
    db.prisma.webhookEvent.findMany({ where: { externalId: transactionId } });

  /** Lets the payment deadline pass, and runs the deadline job (RN-RES-07). */
  async function expire(bookingId: string) {
    const { paymentDueAt } = await db.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    clock.set(new Date((paymentDueAt ?? new Date()).getTime() + 60_000));
    expect(await api.app().get(BookingDeadlines).expire(bookingId, 'PENDING_PAYMENT')).toBe(
      'expired',
    );
  }

  describe('POST /v1/bookings/:id/payments', () => {
    it('gives the owner a Wompi link for the booking total, valid until the deadline (RN-PAG-02, RN-PRE-07)', async () => {
      const daniela = await owner();
      const booking = await daniela.book();

      const { body } = await daniela.pay(booking.id).expect(200);

      const payment = await db.prisma.payment.findUniqueOrThrow({ where: { id: body.id } });
      expect(payment).toMatchObject({
        bookingId: booking.id,
        provider: 'WOMPI',
        status: 'PENDING',
        amountCents: booking.price.totalCents,
      });
      const link = wompi.linkOf(payment.id);
      expect(link).toMatchObject({
        // identificadorEnlaceComercio is the payment attempt, not the booking.
        reference: payment.id,
        amountCents: booking.price.totalCents,
        productName: 'Reserva Pawie: Visita a domicilio con Carlos H.',
        redirectUrl: 'https://api.pawie.test/v1/payments/return',
        webhookUrl: 'https://api.pawie.test/v1/payments/webhook',
        expiresAt: new Date(booking.paymentDueAt ?? ''),
      });
      expect(payment).toMatchObject({ providerLinkId: link.id, checkoutUrl: link.url });
      expect(body).toEqual({
        id: payment.id,
        status: 'PENDING',
        amountCents: booking.price.totalCents,
        checkoutUrl: link.url,
        approvedAt: null,
        createdAt: payment.createdAt.toISOString(),
      });
      expect((await daniela.get(booking.id)).payment).toEqual(body);
    });

    it('returns the same link while it is pending, even to two taps at once', async () => {
      const daniela = await owner();
      const booking = await daniela.book();

      const [first, second] = await Promise.all([
        daniela.pay(booking.id).expect(200),
        daniela.pay(booking.id).expect(200),
      ]);
      const third = await daniela.pay(booking.id).expect(200);

      expect(second.body).toEqual(first.body);
      expect(third.body).toEqual(first.body);
      expect(await db.prisma.payment.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(wompi.links.filter(({ reference }) => reference === first.body.id)).toHaveLength(1);
    });

    it('shows no payment on a booking nobody has paid yet', async () => {
      const daniela = await owner();
      const booking = await daniela.book();

      expect(booking.payment).toBeNull();
    });

    it("hides another owner's booking", async () => {
      const booking = await (await owner()).book();

      const { body } = await (await owner()).pay(booking.id).expect(404);

      expect(body.errorCode).toBe('BOOKING_NOT_FOUND');
    });

    it('only takes a payment while the booking waits for one, before the deadline (RN-RES-07)', async () => {
      const daniela = await owner();
      const cancelled = await daniela.book();
      await api.app().get(BookingsService).cancel(daniela.user.id, cancelled.id);
      const start = new Date();
      clock.set(start);
      const overdue = await daniela.book();

      const afterCancelling = await daniela.pay(cancelled.id).expect(409);
      clock.set(new Date(start.getTime() + 2 * HOUR_MS));
      const afterTheDeadline = await daniela.pay(overdue.id).expect(409);

      expect(afterCancelling.body).toMatchObject({
        errorCode: 'BOOKING_NOT_PAYABLE',
        message: 'Esta reserva ya no se puede pagar.',
        details: { status: 'CANCELLED_BY_OWNER' },
      });
      expect(afterTheDeadline.body).toMatchObject({
        errorCode: 'BOOKING_NOT_PAYABLE',
        message: 'Venció el plazo para pagar esta reserva.',
      });
      expect(
        await db.prisma.payment.count({ where: { bookingId: { in: [cancelled.id, overdue.id] } } }),
      ).toBe(0);
    });

    it('leaves no payment behind when Wompi fails, so the owner can try again', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      wompi.failure = new WompiError('EnlacePago answered 503', 503);

      const { body } = await daniela.pay(booking.id).expect(502);

      expect(body).toMatchObject({ errorCode: 'PAYMENT_GATEWAY_ERROR' });
      expect(await db.prisma.payment.count({ where: { bookingId: booking.id } })).toBe(0);
      await daniela.pay(booking.id).expect(200);
    });
  });

  describe('POST /v1/payments/webhook (docs/arquitectura.md §6)', () => {
    beforeAll(async () => {
      // RN-CTA-04: the owner sees it once the booking is confirmed.
      await db.prisma.user.update({ where: { id: carlos }, data: { phone: '+503 2200 0000' } });
    });

    it('confirms the booking when Wompi approves the payment in time (RN-PAG-02, RN-CTA-04)', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);
      expect(booking.caregiver.phone).toBeNull();

      const paid = wompi.pay(link);
      await deliver(paid).expect(200);

      const row = await bookingRow(booking.id);
      expect(row).toMatchObject({ status: 'CONFIRMED', blocksCalendar: true });
      expect(row.statusChanges.at(-1)).toMatchObject({
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'CONFIRMED',
        changedById: null,
        reason: 'RN-PAG-02: Wompi aprobó el pago.',
      });
      const payment = await paymentRow(link.reference);
      expect(payment).toMatchObject({
        status: 'APPROVED',
        providerTransactionId: paid.transactionId,
        // RN-PAG-01: a test transaction (esReal = false).
        isLive: false,
      });
      expect(payment.approvedAt).toBeInstanceOf(Date);
      // §6: the API asked Wompi before confirming.
      expect(wompi.queried).toContain(paid.transactionId);
      const [event] = await eventsOf(paid.transactionId);
      expect(event).toMatchObject({ provider: 'WOMPI', paymentId: payment.id, error: null });
      expect(event.processedAt).toBeInstanceOf(Date);
      expect(event.payload).toEqual(JSON.parse(paid.body));

      const shown = await daniela.get(booking.id);
      expect(shown).toMatchObject({
        status: 'CONFIRMED',
        paymentDueAt: null,
        caregiver: { phone: '+503 2200 0000' },
        payment: { id: payment.id, status: 'APPROVED', checkoutUrl: null },
      });
    });

    it('does nothing with a webhook it already processed', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const paid = wompi.pay(await checkout(daniela, booking.id));
      await deliver(paid).expect(200);
      const before = await bookingRow(booking.id);

      await deliver(paid).expect(200);
      await deliver(paid).expect(200);

      expect(await bookingRow(booking.id)).toEqual(before);
      expect(await eventsOf(paid.transactionId)).toHaveLength(1);
      expect(wompi.queried.filter((id) => id === paid.transactionId)).toHaveLength(1);
    });

    it('rejects a webhook whose signature does not match, and keeps nothing of it', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const paid = wompi.pay(await checkout(daniela, booking.id));
      const tampered = { ...paid, body: paid.body.replace('"Cantidad":1', '"Cantidad":2') };

      const responses = [
        await deliver(paid, signWebhook(paid.body, 'another-secret')).expect(401),
        await deliver(paid, null).expect(401),
        await deliver(tampered).expect(401),
      ];

      for (const { body } of responses) {
        expect(body).toMatchObject({ errorCode: 'INVALID_WEBHOOK_SIGNATURE' });
      }
      // Without a JSON body there is nothing whose signature to check.
      const { body: notJson } = await api
        .http()
        .post('/v1/payments/webhook')
        .set('content-type', 'text/plain')
        .set('wompi_hash', paid.signature)
        .send(paid.body)
        .expect(400);
      expect(notJson).toMatchObject({ errorCode: 'INVALID_WEBHOOK' });
      expect(await eventsOf(paid.transactionId)).toHaveLength(0);
      expect((await bookingRow(booking.id)).status).toBe('PENDING_PAYMENT');
      // The real webhook still counts afterwards.
      await deliver(paid).expect(200);
      expect((await bookingRow(booking.id)).status).toBe('CONFIRMED');
    });

    it('confirms a payment approved after the deadline if the time is still free (RN-PAG-06)', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);
      await expire(booking.id);

      await deliver(wompi.pay(link)).expect(200);

      const row = await bookingRow(booking.id);
      expect(row).toMatchObject({ status: 'CONFIRMED', blocksCalendar: true });
      expect(row.statusChanges.at(-1)).toMatchObject({
        fromStatus: 'EXPIRED',
        toStatus: 'CONFIRMED',
        reason: 'RN-PAG-06: Wompi aprobó el pago después del plazo y el horario seguía libre.',
      });
      expect((await paymentRow(link.reference)).status).toBe('APPROVED');
    });

    it('sends a late payment to refund if another booking took the time (RN-PAG-06)', async () => {
      const daniela = await owner();
      const visit = nextVisit();
      const booking = await daniela.book(visit);
      const link = await checkout(daniela, booking.id);
      await expire(booking.id);
      clock.reset();
      const other = await (await owner()).book(visit);

      const paid = wompi.pay(link);
      await deliver(paid).expect(200);

      expect((await bookingRow(booking.id)).status).toBe('EXPIRED');
      expect((await bookingRow(other.id)).status).toBe('PENDING_PAYMENT');
      const payment = await paymentRow(link.reference);
      expect(payment).toMatchObject({
        status: 'REFUND_PENDING',
        providerTransactionId: paid.transactionId,
      });
      expect(payment.approvedAt).toBeInstanceOf(Date);
      expect((await eventsOf(paid.transactionId))[0].processedAt).toBeInstanceOf(Date);
      expect((await daniela.get(booking.id)).payment).toMatchObject({ status: 'REFUND_PENDING' });
    });

    it('sends a second approved payment of the same booking to refund, even at the same time (RN-PAG-07)', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const first = await checkout(daniela, booking.id);
      // An earlier attempt whose link was still open.
      const earlier = await db.prisma.payment.create({
        data: {
          bookingId: booking.id,
          provider: 'WOMPI',
          amountCents: first.amountCents,
          providerLinkId: '999001',
          checkoutUrl: 'https://lk.wompi.test/999001',
        },
      });

      await Promise.all([
        deliver(wompi.pay(first)).expect(200),
        deliver(
          wompi.pay({ id: '999001', reference: earlier.id, amountCents: first.amountCents }),
        ).expect(200),
      ]);

      const row = await bookingRow(booking.id);
      expect(row.status).toBe('CONFIRMED');
      expect(row.payments.map(({ status }) => status).toSorted()).toEqual([
        'APPROVED',
        'REFUND_PENDING',
      ]);
      const approved = row.payments.find(({ status }) => status === 'APPROVED');
      expect((await daniela.get(booking.id)).payment).toMatchObject({ id: approved?.id });
    });

    it('records a second transaction on the same link as its own payment to refund (RN-PAG-07)', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);
      await deliver(wompi.pay(link)).expect(200);

      const again = wompi.pay(link);
      await deliver(again).expect(200);

      const extra = await db.prisma.payment.findUniqueOrThrow({
        where: { providerTransactionId: again.transactionId },
      });
      expect(extra).toMatchObject({
        bookingId: booking.id,
        status: 'REFUND_PENDING',
        amountCents: link.amountCents,
      });
      expect((await paymentRow(link.reference)).status).toBe('APPROVED');
      expect((await eventsOf(again.transactionId))[0].paymentId).toBe(extra.id);
    });

    it('sends the payment of a booking the owner cancelled to refund', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);
      await api.app().get(BookingsService).cancel(daniela.user.id, booking.id);

      await deliver(wompi.pay(link)).expect(200);

      expect((await bookingRow(booking.id)).status).toBe('CANCELLED_BY_OWNER');
      expect((await paymentRow(link.reference)).status).toBe('REFUND_PENDING');
    });

    it('sends an approved payment of another amount to refund', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);

      await deliver(wompi.pay(link, { amountCents: link.amountCents - 100 })).expect(200);

      expect((await bookingRow(booking.id)).status).toBe('PENDING_PAYMENT');
      expect((await paymentRow(link.reference)).status).toBe('REFUND_PENDING');
    });

    it('changes nothing while the query does not confirm the transaction, and keeps the event to retry', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);
      const unconfirmed = wompi.pay(link, { approved: false });

      await deliver(unconfirmed).expect(200);

      expect((await bookingRow(booking.id)).status).toBe('PENDING_PAYMENT');
      expect(await paymentRow(link.reference)).toMatchObject({
        status: 'PENDING',
        providerTransactionId: null,
        approvedAt: null,
      });
      const [event] = await eventsOf(unconfirmed.transactionId);
      expect(event).toMatchObject({
        processedAt: null,
        paymentId: link.reference,
        error: 'Wompi does not report the transaction as approved',
      });
      expect((await daniela.get(booking.id)).payment).toMatchObject({ status: 'PENDING' });
    });

    it('records a webhook for a payment it does not know, without retrying it', async () => {
      const delivery = webhookFor({
        transactionId: randomUUID(),
        linkId: '1',
        reference: randomUUID(),
        amountCents: 1870,
      });

      await deliver(delivery).expect(200);

      const [event] = await eventsOf(delivery.transactionId);
      expect(event).toMatchObject({
        paymentId: null,
        error: 'No payment matches the payment link',
      });
      expect(event.processedAt).toBeInstanceOf(Date);
    });

    it('rejects a signed body without the transaction or the payment', async () => {
      const body = JSON.stringify({ ResultadoTransaccion: 'ExitosaAprobada' });

      const { body: error } = await deliver({
        transactionId: '',
        body,
        signature: signWebhook(body),
      }).expect(400);

      expect(error).toMatchObject({ errorCode: 'INVALID_WEBHOOK' });
    });
  });

  describe('retrying webhooks that could not be applied', () => {
    const webhooks = () => api.app().get(PaymentWebhooks);
    /** The retries skip events younger than a minute, which their own request is applying. */
    const aFewMinutesLater = () => clock.set(new Date(Date.now() + 2 * 60_000));

    it('applies an event once Wompi confirms the transaction', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);
      const paid = wompi.pay(link, { approved: false });
      await deliver(paid).expect(200);

      await webhooks().retryPending();
      expect((await bookingRow(booking.id)).status).toBe('PENDING_PAYMENT');

      wompi.transactions.set(paid.transactionId, {
        id: paid.transactionId,
        approved: true,
        isLive: false,
        amountCents: link.amountCents,
      });
      aFewMinutesLater();
      expect(await webhooks().retryPending()).toBeGreaterThanOrEqual(1);

      expect((await bookingRow(booking.id)).status).toBe('CONFIRMED');
      const [event] = await eventsOf(paid.transactionId);
      expect(event).toMatchObject({ error: null, paymentId: link.reference });
      expect(event.processedAt).toBeInstanceOf(Date);
    });

    it('keeps an event when Wompi does not answer the query, and applies it once Wompi is back', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const paid = wompi.pay(await checkout(daniela, booking.id));
      wompi.queryFailure = new WompiError('Wompi did not answer: TimeoutError');

      // Wompi still gets its 200: the event is stored.
      await deliver(paid).expect(200);

      const [event] = await eventsOf(paid.transactionId);
      expect(event).toMatchObject({
        processedAt: null,
        error: 'WompiError: Wompi did not answer: TimeoutError',
      });
      expect((await bookingRow(booking.id)).status).toBe('PENDING_PAYMENT');

      wompi.queryFailure = null;
      aFewMinutesLater();
      await webhooks().retryPending();

      expect((await bookingRow(booking.id)).status).toBe('CONFIRMED');
    });

    it('retries every 5 minutes', async () => {
      const queue = api.app().get<Queue>(getQueueToken(PAYMENTS_QUEUE));

      await vi.waitFor(async () => {
        expect(await queue.getJobSchedulers()).toEqual([
          expect.objectContaining({ key: RETRY_WEBHOOKS_JOB, every: 5 * 60_000 }),
        ]);
      });
    });
  });

  describe('GET /v1/payments/return', () => {
    it('sends the owner back to the app with the booking, and changes nothing (RN-PAG-02)', async () => {
      const daniela = await owner();
      const booking = await daniela.book();
      const link = await checkout(daniela, booking.id);
      const before = await bookingRow(booking.id);

      // The parameters of a payment link redirect (docs.wompi.sv, "Parámetros de URL de Redirect").
      const { headers } = await api
        .http()
        .get('/v1/payments/return')
        .query({
          identificadorEnlaceComercio: link.reference,
          idTransaccion: randomUUID(),
          idEnlace: link.id,
          monto: (link.amountCents / 100).toFixed(2),
          hash: 'f'.repeat(64),
        })
        .expect(302);

      expect(headers.location).toBe(
        `pawie://payment/result?bookingId=${booking.id}&paymentId=${link.reference}`,
      );
      expect(await bookingRow(booking.id)).toEqual(before);
    });

    it('still opens the app when the payment is unknown', async () => {
      for (const query of [
        {},
        { identificadorEnlaceComercio: randomUUID() },
        { identificadorEnlaceComercio: 'x' },
      ]) {
        const { headers } = await api.http().get('/v1/payments/return').query(query).expect(302);
        expect(headers.location).toBe('pawie://payment/result');
      }
    });
  });

  describe('without Wompi credentials', () => {
    const offline = useApi(() => db, {
      override: (builder) => builder.overrideProvider(WOMPI_SETTINGS).useValue(null),
    });

    it('answers that payments are unavailable, and everything else works', async () => {
      const user = await createUser(db.prisma);
      const token = await offline.tokenFor(user);

      const { body } = await offline
        .http()
        .post(`/v1/bookings/${randomUUID()}/payments`)
        .auth(token, { type: 'bearer' })
        .expect(503);

      expect(body).toMatchObject({ errorCode: 'PAYMENTS_UNAVAILABLE' });
      await offline.http().get('/v1/bookings').auth(token, { type: 'bearer' }).expect(200);
    });
  });
});
