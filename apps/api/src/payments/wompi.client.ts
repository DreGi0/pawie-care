import { Inject, Injectable } from '@nestjs/common';
import { isoInElSalvador } from '../common/time/calendar.js';
import { Clock } from '../common/time/clock.js';
import type { WompiSettings } from '../config/environment.js';
import { WOMPI_SETTINGS } from './wompi-settings.js';

// Wompi El Salvador (docs/arquitectura.md §6, https://docs.wompi.sv).
const TOKEN_URL = 'https://id.wompi.sv/connect/token';
const API_URL = 'https://api.wompi.sv';

/** A token is renewed this long before it expires, so it never expires in flight. */
const TOKEN_RENEWAL_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface PaymentLinkRequest {
  /** identificadorEnlaceComercio: the ID of the Payment, which the webhook brings back. */
  reference: string;
  amountCents: number;
  /** What the payment page shows. */
  productName: string;
  /** Where Wompi sends the owner after paying. */
  redirectUrl: string;
  webhookUrl: string;
  /** From then on the link takes no payments (vigencia.fechaFin). */
  expiresAt: Date;
}

export interface PaymentLink {
  /** Wompi's idEnlace. */
  id: string;
  /** The page where the owner pays. */
  url: string;
}

export interface WompiTransaction {
  id: string;
  approved: boolean;
  /** esReal: false for test transactions (RN-PAG-01). */
  isLive: boolean;
  amountCents: number;
}

/** The calls the API makes to Wompi. The tests replace them, because CI can't reach Wompi. */
export interface WompiApi {
  createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLink>;
  /** The transaction, or null if Wompi doesn't know it. */
  getTransaction(id: string): Promise<WompiTransaction | null>;
}

/** Wompi didn't answer, refused the call or answered something unexpected. */
export class WompiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'WompiError';
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

interface PaymentLinkResponse {
  idEnlace: number;
  urlEnlace: string;
}

interface TransactionResponse {
  esAprobada: boolean;
  esReal: boolean;
  monto: number;
}

/**
 * Wompi's API with Node's fetch. It authenticates with OAuth2 client credentials and
 * reuses the token until shortly before it expires (an hour, per Wompi).
 */
@Injectable()
export class WompiClient implements WompiApi {
  private token: { value: string; expiresAt: number } | null = null;
  /** The token request in flight, which concurrent calls share. */
  private tokenRequest: Promise<string> | null = null;

  constructor(
    @Inject(WOMPI_SETTINGS) private readonly settings: WompiSettings | null,
    private readonly clock: Clock,
  ) {}

  /**
   * An Enlace de Pago for one successful payment by card, valid until `expiresAt`. The
   * owner can retry on the same link after a declined card.
   */
  async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLink> {
    const response = await this.call('/EnlacePago', {
      method: 'POST',
      body: JSON.stringify({
        identificadorEnlaceComercio: request.reference,
        monto: request.amountCents / 100,
        nombreProducto: request.productName,
        formaPago: {
          permitirTarjetaCreditoDebido: true,
          permitirPagoConPuntoAgricola: false,
          permitirPagoEnCuotasAgricola: false,
          permitirPagoEnBitcoin: false,
          permitePagoQuickPay: false,
        },
        configuracion: {
          urlRedirect: request.redirectUrl,
          urlWebhook: request.webhookUrl,
          esMontoEditable: false,
          esCantidadEditable: false,
          // Wompi emails the owner a receipt.
          notificarTransaccionCliente: true,
        },
        // Wompi's examples are in El Salvador time; the offset makes it unambiguous.
        vigencia: { fechaFin: isoInElSalvador(request.expiresAt) },
        limitesDeUso: { cantidadMaximaPagosExitosos: 1 },
      }),
    });
    const link = await json<PaymentLinkResponse>(response, 'EnlacePago');
    if (typeof link.idEnlace !== 'number' || typeof link.urlEnlace !== 'string') {
      throw new WompiError('EnlacePago answered without idEnlace or urlEnlace');
    }
    return { id: String(link.idEnlace), url: link.urlEnlace };
  }

  async getTransaction(id: string): Promise<WompiTransaction | null> {
    const response = await this.call(`/TransaccionCompra/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    if (response.status === 404) {
      return null;
    }
    const transaction = await json<TransactionResponse>(response, 'TransaccionCompra');
    if (typeof transaction.monto !== 'number') {
      throw new WompiError('TransaccionCompra answered without monto');
    }
    return {
      // The ID that was asked for: it keys the payment, whatever the body says.
      id,
      approved: transaction.esAprobada === true,
      isLive: transaction.esReal === true,
      amountCents: Math.round(transaction.monto * 100),
    };
  }

  /** Calls the API with the token. If Wompi no longer takes it, gets a new one and retries once. */
  private async call(path: string, init: RequestInit, retry = true): Promise<Response> {
    const response = await send(`${API_URL}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
    });
    if (response.status === 401 && retry) {
      this.token = null;
      return this.call(path, init, false);
    }
    return response;
  }

  private accessToken(): Promise<string> {
    if (this.token && this.clock.now().getTime() < this.token.expiresAt) {
      return Promise.resolve(this.token.value);
    }
    this.tokenRequest ??= this.requestToken().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  private async requestToken(): Promise<string> {
    const { settings } = this;
    if (!settings) {
      throw new WompiError('Wompi is not configured');
    }
    const requestedAt = this.clock.now().getTime();
    const response = await send(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        audience: 'wompi_api',
        client_id: settings.appId,
        client_secret: settings.apiSecret,
      }),
    });
    const token = await json<TokenResponse>(response, 'the token endpoint');
    if (typeof token.access_token !== 'string' || typeof token.expires_in !== 'number') {
      throw new WompiError('The token endpoint answered without access_token or expires_in');
    }
    this.token = {
      value: token.access_token,
      expiresAt: requestedAt + token.expires_in * 1000 - TOKEN_RENEWAL_MARGIN_MS,
    };
    return token.access_token;
  }
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new WompiError(`Wompi did not answer: ${String(error)}`);
  }
}

/** The JSON body of a successful response. */
async function json<T>(response: Response, what: string): Promise<T> {
  if (!response.ok) {
    // The body says why; it never carries the credentials.
    const detail = (await response.text().catch(() => '')).slice(0, 500);
    throw new WompiError(`${what} answered ${response.status}: ${detail}`, response.status);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new WompiError(`${what} answered something that is not JSON`, response.status);
  }
}
