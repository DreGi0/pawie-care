import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Wompi signs each webhook in the `wompi_hash` header: an HMAC-SHA256 of the body as it
 * arrived, keyed with the API Secret, in hex (https://docs.wompi.sv/webhook/validar-webhook).
 */
export function wompiSignature(rawBody: Buffer, apiSecret: string): string {
  return createHmac('sha256', apiSecret).update(rawBody).digest('hex');
}

export function hasValidWompiSignature(
  rawBody: Buffer,
  signature: string | undefined,
  apiSecret: string,
): boolean {
  if (!signature) {
    return false;
  }
  const expected = Buffer.from(wompiSignature(rawBody, apiSecret), 'hex');
  const received = Buffer.from(signature.trim().toLowerCase(), 'hex');
  // Compared in constant time, so the response time says nothing about the signature.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** What the API reads from a webhook (https://docs.wompi.sv/webhook/definicion-webhook). */
export interface WompiWebhook {
  /** IdTransaccion: the event is about it, and it's discarded once processed. */
  transactionId: string;
  /** EnlacePago.IdentificadorEnlaceComercio: the ID of the Payment. */
  reference: string;
  /** EnlacePago.Id: Wompi's idEnlace. */
  linkId: string | null;
  /** FechaTransaccion. */
  paidAt: Date | null;
}

/**
 * Reads a webhook's body, or null if it lacks what the API needs. Wompi writes the
 * fields in PascalCase; camelCase is accepted too, in case its serializer changes.
 */
export function parseWompiWebhook(body: unknown): WompiWebhook | null {
  const transactionId = field(body, 'IdTransaccion');
  const link = field(body, 'EnlacePago');
  const reference = field(link, 'IdentificadorEnlaceComercio');
  if (!isNonEmptyString(transactionId) || !isNonEmptyString(reference)) {
    return null;
  }
  const linkId = field(link, 'Id');
  const paidAt = field(body, 'FechaTransaccion');
  const paidAtDate = typeof paidAt === 'string' ? new Date(paidAt) : null;
  return {
    transactionId,
    reference,
    linkId: typeof linkId === 'number' || isNonEmptyString(linkId) ? String(linkId) : null,
    paidAt: paidAtDate && !Number.isNaN(paidAtDate.getTime()) ? paidAtDate : null,
  };
}

function field(value: unknown, pascalCaseName: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const camelCaseName = pascalCaseName.charAt(0).toLowerCase() + pascalCaseName.slice(1);
  return record[pascalCaseName] ?? record[camelCaseName];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
