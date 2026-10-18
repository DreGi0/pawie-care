import { randomUUID } from 'node:crypto';
import { BookingsService } from '../src/bookings/bookings.service.js';
import { addDays, dateInElSalvador, formatDateOnly } from '../src/common/time/calendar.js';
import { Clock } from '../src/common/time/clock.js';
import { Role } from '../src/generated/prisma/client.js';
import { WompiClient, WompiError } from '../src/payments/wompi.client.js';
import { WOMPI_SETTINGS } from '../src/payments/wompi-settings.js';
import { seedDatabase } from '../src/seed/seed-database.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { createTestDatabase, type TestDatabase } from './database.js';
import { FakeWompi } from './fake-wompi.js';
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
