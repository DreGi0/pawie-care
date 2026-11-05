import type { PaymentClient } from '@pawie/api-client';

// Web version of checkout.ts: there is no `pawie://` to come back to.

/** The API redirects the owner to <web>/payment/result when the link is made for the web. */
export const paymentClient: PaymentClient | undefined = 'web';

/**
 * Goes to Wompi's payment page in the same tab. The promise never resolves on purpose: the
 * page is leaving, and Wompi's redirect brings the owner back to /payment/result.
 */
export function openCheckout(checkoutUrl: string): Promise<void> {
  window.location.assign(checkoutUrl);
  return new Promise<void>(() => {});
}
