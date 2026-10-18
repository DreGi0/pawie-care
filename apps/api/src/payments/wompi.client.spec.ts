import type { Clock } from '../common/time/clock.js';
import type { WompiSettings } from '../config/environment.js';
import { WompiClient, WompiError } from './wompi.client.js';

const MINUTE_MS = 60_000;

const SETTINGS: WompiSettings = {
  appId: 'the-app-id',
  apiSecret: 'the-api-secret',
  publicApiUrl: 'https://api.pawie.test',
};

const LINK_REQUEST = {
  reference: '019a0000-0000-7000-8000-000000000001',
  amountCents: 1870,
  productName: 'Reserva Pawie: Visita a domicilio con Valeria M.',
  redirectUrl: 'https://api.pawie.test/v1/payments/return',
  webhookUrl: 'https://api.pawie.test/v1/payments/webhook',
  expiresAt: new Date('2026-10-18T21:00:00.500Z'),
};

describe('WompiClient', () => {
  let now: Date;
  /** The client always calls fetch with a string URL. */
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
  let wompi: WompiClient;
  let tokenCount: number;

  /** Wompi as the docs describe it: tokens last an hour. */
  function wompiAnswers(api: (url: string, init: RequestInit) => Response) {
    fetchMock.mockImplementation(async (url, init = {}) => {
      if (url === 'https://id.wompi.sv/connect/token') {
        tokenCount += 1;
        return Response.json({
          access_token: `token-${tokenCount}`,
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'wompi_api',
        });
      }
      return api(url, init);
    });
  }

  const apiCalls = () =>
    fetchMock.mock.calls.filter(([url]) => url.startsWith('https://api.wompi.sv'));
  const tokenCalls = () =>
    fetchMock.mock.calls.filter(([url]) => url === 'https://id.wompi.sv/connect/token');
  const authorizationOf = ([, init]: [string, RequestInit?]) =>
    new Headers(init?.headers).get('authorization');

  const transaction = { idTransaccion: 'tx-1', esAprobada: true, esReal: false, monto: 18.7 };

  beforeEach(() => {
    now = new Date('2026-10-18T15:00:00Z');
    tokenCount = 0;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    wompi = new WompiClient(SETTINGS, { now: () => now } as Clock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gets a token with the client credentials and reuses it until shortly before it expires', async () => {
    wompiAnswers(() => Response.json(transaction));

    await wompi.getTransaction('tx-1');
    now = new Date(now.getTime() + 58 * MINUTE_MS);
    await wompi.getTransaction('tx-1');
    now = new Date(now.getTime() + MINUTE_MS);
    await wompi.getTransaction('tx-1');

    expect(tokenCalls()).toHaveLength(2);
    const [, init] = tokenCalls()[0];
    expect(init?.method).toBe('POST');
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      grant_type: 'client_credentials',
      audience: 'wompi_api',
      client_id: 'the-app-id',
      client_secret: 'the-api-secret',
    });
    expect(apiCalls().map(authorizationOf)).toEqual([
      'Bearer token-1',
      'Bearer token-1',
      'Bearer token-2',
    ]);
  });

  it('shares one token request among calls made at the same time', async () => {
    wompiAnswers(() => Response.json(transaction));

    await Promise.all([wompi.getTransaction('tx-1'), wompi.getTransaction('tx-2')]);

    expect(tokenCalls()).toHaveLength(1);
  });

  it('creates a payment link for one card payment that expires at the deadline', async () => {
    wompiAnswers(() =>
      Response.json({
        idEnlace: 1384854,
        urlEnlace: 'https://lk.wompi.sv/abcd',
        urlQrCodeEnlace: 'https://lk.wompi.sv/abcd.png',
        estaProductivo: false,
      }),
    );

    const link = await wompi.createPaymentLink(LINK_REQUEST);

    expect(link).toEqual({ id: '1384854', url: 'https://lk.wompi.sv/abcd' });
    const [[url, init]] = apiCalls();
    expect(url).toBe('https://api.wompi.sv/EnlacePago');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      identificadorEnlaceComercio: LINK_REQUEST.reference,
      monto: 18.7,
      nombreProducto: LINK_REQUEST.productName,
      formaPago: {
        permitirTarjetaCreditoDebido: true,
        permitirPagoConPuntoAgricola: false,
        permitirPagoEnCuotasAgricola: false,
        permitirPagoEnBitcoin: false,
        permitePagoQuickPay: false,
      },
      configuracion: {
        urlRedirect: LINK_REQUEST.redirectUrl,
        urlWebhook: LINK_REQUEST.webhookUrl,
        esMontoEditable: false,
        esCantidadEditable: false,
        notificarTransaccionCliente: true,
      },
      vigencia: { fechaFin: '2026-10-18T15:00:00-06:00' },
      limitesDeUso: { cantidadMaximaPagosExitosos: 1 },
    });
  });

  it('reads a transaction in cents, and whether it is approved and real (RN-PAG-01)', async () => {
    wompiAnswers((url) =>
      url.endsWith('/TransaccionCompra/tx-1')
        ? Response.json(transaction)
        : new Response('', { status: 404 }),
    );

    expect(await wompi.getTransaction('tx-1')).toEqual({
      id: 'tx-1',
      approved: true,
      isLive: false,
      amountCents: 1870,
    });
    expect(await wompi.getTransaction('unknown')).toBeNull();
  });

  it('gets a new token and retries once when Wompi no longer takes the current one', async () => {
    let calls = 0;
    wompiAnswers(() => {
      calls += 1;
      return calls === 1 ? new Response('', { status: 401 }) : Response.json(transaction);
    });

    await wompi.getTransaction('tx-1');

    expect(apiCalls().map(authorizationOf)).toEqual(['Bearer token-1', 'Bearer token-2']);
  });

  it('fails with the status and the reason Wompi gives, never with the secret', async () => {
    wompiAnswers(() => new Response('{"mensajes":["Monto inválido"]}', { status: 400 }));

    const error = await wompi.createPaymentLink(LINK_REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WompiError);
    expect(error).toMatchObject({
      status: 400,
      message: expect.stringContaining('Monto inválido'),
    });
    expect(String(error)).not.toContain('the-api-secret');
  });

  it('fails when Wompi does not answer', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(wompi.getTransaction('tx-1')).rejects.toThrow(WompiError);
  });
});
