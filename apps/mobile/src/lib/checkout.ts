import type { PaymentClient } from '@pawie/api-client';
import * as WebBrowser from 'expo-web-browser';

// Where the API sends the owner back after paying in Wompi (docs/arquitectura.md §6).
const PAYMENT_RETURN_URL = 'pawie://payment/result';

/** Sent to POST /v1/bookings/:id/payments. The phone sends nothing: the default is `app`. */
export const paymentClient: PaymentClient | undefined = undefined;

/**
 * Opens Wompi's payment page and resolves when the owner is back. The web version, in
 * checkout.web.ts, leaves the app instead.
 */
export async function openCheckout(checkoutUrl: string): Promise<void> {
  await WebBrowser.openAuthSessionAsync(checkoutUrl, PAYMENT_RETURN_URL);
}
