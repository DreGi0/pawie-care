import { createHmac, randomUUID } from 'node:crypto';
// Only types from src/: setup-env.ts imports this file before the environment is set.
import type {
  PaymentLink,
  PaymentLinkRequest,
  WompiApi,
  WompiTransaction,
} from '../src/payments/wompi.client.js';

/** The API Secret of the tests (setup-env.ts). */
export const TEST_WOMPI_API_SECRET = 'test-wompi-api-secret';

/** A webhook as Wompi sends it. */
export interface WompiDelivery {
  transactionId: string;
  /** The body as it travels, which the signature covers. */
  body: string;
  /** The `wompi_hash` header. */
  signature: string;
}

/** HMAC-SHA256 of the body with the API Secret, in hex, like Wompi's `wompi_hash`. */
export function signWebhook(body: string, secret = TEST_WOMPI_API_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * The webhook Wompi sends when a transaction on a payment link succeeds, with the
 * fields of https://docs.wompi.sv/webhook/definicion-webhook.
 */
export function webhookFor({
  transactionId,
  linkId,
  reference,
  amountCents,
}: {
  transactionId: string;
  linkId: string;
  reference: string;
  amountCents: number;
}): WompiDelivery {
  const body = JSON.stringify({
    IdCuenta: '980b36e6-6d3b-4a3a-9a52-1c2b3d4e5f60',
    FechaTransaccion: new Date().toISOString(),
    Monto: amountCents / 100,
    ModuloUtilizado: 'EnlacePago',
    FormaPagoUtilizada: 'PagoNormal',
    IdTransaccion: transactionId,
    ResultadoTransaccion: 'ExitosaAprobada',
    CodigoAutorizacion: randomUUID(),
    IdIntentoPago: randomUUID(),
    Cantidad: 1,
    EsProductiva: false,
    Aplicativo: { Nombre: 'Pawie Care', Url: 'https://pawie.test', Id: randomUUID() },
    EnlacePago: {
      Id: Number(linkId),
      IdentificadorEnlaceComercio: reference,
      NombreProducto: 'Reserva Pawie',
    },
    cliente: { Nombre: 'Daniela Pérez', Email: 'demo@example.com' },
  });
  return { transactionId, body, signature: signWebhook(body) };
}

/**
 * Wompi for the integration tests, because CI can't reach it. It keeps the links the
 * API creates, and answers the transaction queries with what the test registered.
 */
export class FakeWompi implements WompiApi {
  readonly links: (PaymentLinkRequest & PaymentLink)[] = [];
  readonly transactions = new Map<string, WompiTransaction>();
  /** The transaction IDs the API queried, in order. */
  readonly queried: string[] = [];
  /** The next createPaymentLink() fails with it. */
  failure: Error | null = null;
  /** Every getTransaction() fails with it while it's set, as if Wompi were down. */
  queryFailure: Error | null = null;
  private lastLinkId = 1_384_000;

  createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLink> {
    const { failure } = this;
    if (failure) {
      this.failure = null;
      return Promise.reject(failure);
    }
    this.lastLinkId += 1;
    const link = { id: String(this.lastLinkId), url: `https://lk.wompi.test/${this.lastLinkId}` };
    this.links.push({ ...request, ...link });
    return Promise.resolve(link);
  }

  getTransaction(id: string): Promise<WompiTransaction | null> {
    this.queried.push(id);
    if (this.queryFailure) {
      return Promise.reject(this.queryFailure);
    }
    return Promise.resolve(this.transactions.get(id) ?? null);
  }

  /**
   * The owner pays on the link: Wompi records a test transaction (esReal is false) and
   * sends its webhook. With `approved: false`, the query doesn't confirm it.
   */
  pay(
    link: { id: string; reference: string; amountCents: number },
    { approved = true, amountCents = link.amountCents } = {},
  ): WompiDelivery {
    const transactionId = randomUUID();
    this.transactions.set(transactionId, {
      id: transactionId,
      approved,
      isLive: false,
      amountCents,
    });
    return webhookFor({ transactionId, linkId: link.id, reference: link.reference, amountCents });
  }

  /** The link created for that payment. */
  linkOf(paymentId: string): PaymentLinkRequest & PaymentLink {
    const link = this.links.find(({ reference }) => reference === paymentId);
    if (!link) {
      throw new Error(`No payment link for payment ${paymentId}`);
    }
    return link;
  }
}
