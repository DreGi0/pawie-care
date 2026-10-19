// Written by hand: Orval calls customFetch() from every generated function (see
// orval.config.ts). Everything under src/generated/ is generated.

/** Where the API is and how to sign in to it. The app sets it once, at startup. */
export interface ApiClientConfig {
  /**
   * The API's origin, without /v1. On the Android emulator, the computer is
   * http://10.0.2.2:3000; on the iOS Simulator, http://localhost:3000.
   */
  baseUrl: string;
  /** The access token for the Authorization header, or null when nobody is signed in. */
  getAccessToken?: () => string | null | Promise<string | null>;
}

/** The body of every error of the API (docs/arquitectura.md §4.13). */
export interface ApiErrorBody {
  statusCode: number;
  /** Stable and in English: decide what to do by it, never by the message. */
  errorCode: string;
  /** In Spanish, to show to the user. */
  message: string;
  details?: Record<string, unknown>;
}

/** The API answered with an error. TanStack Query gets it as the query's or mutation's error. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.message ?? `The API answered ${status}`);
    this.name = 'ApiError';
  }

  get errorCode(): string | undefined {
    return this.body?.errorCode;
  }
}

/** The error type of every generated hook. */
export type ErrorType<_Error> = ApiError;

let config: ApiClientConfig | null = null;

/** How long a request waits for the API's answer. */
export const REQUEST_TIMEOUT_MS = 15_000;

export function configureApiClient(next: ApiClientConfig): void {
  config = { ...next, baseUrl: next.baseUrl.replace(/\/+$/, '') };
}

/**
 * Orval's mutator. It adds the base URL and the access token, returns the parsed body
 * of a successful response, and throws ApiError for any other.
 */
export async function customFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (!config) {
    throw new Error('Call configureApiClient() before using @pawie/api-client');
  }
  const headers = new Headers(options.headers);
  const token = await config.getAccessToken?.();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  // An API that never answers (it's off, or a firewall drops the request) would keep the
  // request waiting forever: after REQUEST_TIMEOUT_MS it fails like a network error.
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(`${config.baseUrl}${url}`, { ...options, headers, signal });
  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, isApiErrorBody(body) ? body : null);
  }
  return body as T;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ApiErrorBody).errorCode === 'string' &&
    typeof (body as ApiErrorBody).message === 'string'
  );
}
