// Only types from src/: setup-env.ts imports this file before the environment is set.
import type {
  PaymentLink,
  PaymentLinkRequest,
  WompiApi,
  WompiTransaction,
} from '../src/payments/wompi.client.js';

/** The API Secret of the tests (setup-env.ts). */
export const TEST_WOMPI_API_SECRET = 'test-wompi-api-secret';

/**
 * Wompi for the integration tests, because CI can't reach it. It keeps the links the
 * API creates, and answers the transaction queries with what the test registered.
 */
export class FakeWompi implements WompiApi {
  readonly links: (PaymentLinkRequest & PaymentLink)[] = [];
  readonly transactions = new Map<string, WompiTransaction>();
  /** The next createPaymentLink() fails with it. */
  failure: Error | null = null;
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
    return Promise.resolve(this.transactions.get(id) ?? null);
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
