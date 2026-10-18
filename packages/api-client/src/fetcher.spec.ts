import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, configureApiClient, customFetch } from './fetcher';

describe('customFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    configureApiClient({ baseUrl: 'http://10.0.2.2:3000/', getAccessToken: () => 'the-token' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the API with the access token and returns the body', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'booking-1' }));

    const body = await customFetch<{ id: string }>('/v1/bookings/booking-1', {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    expect(body).toEqual({ id: 'booking-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://10.0.2.2:3000/v1/bookings/booking-1');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer the-token');
    expect(new Headers(init.headers).get('accept')).toBe('application/json');
  });

  it('sends no Authorization header when nobody is signed in', async () => {
    configureApiClient({ baseUrl: 'http://localhost:3000', getAccessToken: () => null });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await customFetch('/v1/auth/logout', { method: 'POST' })).toBeUndefined();
    expect(new Headers(fetchMock.mock.calls[0][1].headers).has('authorization')).toBe(false);
  });

  it('throws ApiError with the errorCode and the Spanish message of the API', async () => {
    const errorBody = {
      statusCode: 409,
      errorCode: 'BOOKING_NOT_PAYABLE',
      message: 'Venció el plazo para pagar esta reserva.',
      details: { status: 'EXPIRED' },
    };
    fetchMock.mockResolvedValue(Response.json(errorBody, { status: 409 }));

    const error = await customFetch('/v1/bookings/b/payments', { method: 'POST' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      errorCode: 'BOOKING_NOT_PAYABLE',
      message: 'Venció el plazo para pagar esta reserva.',
      body: errorBody,
    });
  });

  it('throws ApiError without a body when the error is not the API shape', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    await expect(customFetch('/v1/health')).rejects.toMatchObject({
      status: 502,
      body: null,
      errorCode: undefined,
    });
  });
});
